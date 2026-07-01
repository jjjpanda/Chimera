# Chimera bootstrap <img src="../command/frontend/res/logo.png" alt="logo" width="20"/>

The `chimera/` directory holds the bootstrap layer that runs **before** any service starts: it validates configuration, prepares the Postgres schema, and (on the host, before Docker) runs an interactive config wizard. These are one-shot scripts, not long-running servers — they have no HTTP routes.

---
# Boot chain

`entrypoint.sh` is the container entrypoint. It runs, in order, and aborts on the first failure (`set -e`):

1. `mkdir -p ./.well-known/acme-challenge` — the ACME challenge directory the [gateway](../gateway) serves for TLS certificate issuance.
2. `node chimera/validateEnvVars.js` — fail-fast validation of required env vars.
3. `node chimera/prepareDatabase.js` — idempotently create the Postgres tables and indexes.
4. `exec pm2-runtime pm2.config.js` — hand off to pm2, which launches the Chimera Node process (`server.js`) — a single instance when `chimeraInstances == 1`, or a cluster of `chimeraInstances` instances (which also forces `memory_ON=true`) when it is `>1` or `max` — plus `motion` (when `storage_ON=true`), one `ffmpeg` HLS process per camera (when `livestream_ON=true`), and `heartbeat` (production). See [`../pm2.config.js`](../pm2.config.js).

The preflight wizard is **not** part of this chain — it runs on the host before `docker compose up`.

---
# validateEnvVars.js

Loads `.env` via `dotenv` and checks that every required env var is present. It does **not** short-circuit on the first gap: every check runs unconditionally, and each missing or invalid var prints its own message (`MISSING ENV VAR <name>`, or a path error such as `SHOULD BE AN ABSOLUTE PATH` / `SHOULD BE A FOLDER` / `SHOULD BE A FILE`), so a single run reports **all** problems. `process.exit(1)` is called just once at the very end when anything failed, so the container never boots half-configured.

- **Required vs optional** — keys marked `***` in [`../env.example`](../env.example) are optional and skipped (`optionalKeys` is derived from the schema via `preflight.parseSchema`).
- **Disabled services skip their checks** — the same `preflight.isServiceOff` logic used by the wizard is applied here: a key prefixed `command_`, `schedule_`, `storage_`, `livestream_`, `object_`, `memory_`, or `gateway_` is skipped when its `<prefix>_ON` is `false`. The `<prefix>_ON` toggle itself is always checked. `storage_MOTION_CONF_FILEPATH` is only required when a camera-consuming service (storage/object/livestream) is on.
- **Path checks** — `confirmPath()` additionally verifies that path vars are absolute and are the right kind (file vs folder): `privateKey_FILEPATH`, `certificate_FILEPATH`, `ffmpeg_FILEPATH`, `ffprobe_FILEPATH` must be files; `storage_FOLDERPATH` and `livestream_FOLDERPATH` must be folders.

---
# prepareDatabase.js

Connects to Postgres with the `database_*` env vars and runs each `CREATE TABLE` / `CREATE INDEX` once. It is **idempotent**: a table that already exists surfaces error code `42P07` (`relation already exists`) which is treated as success, and indexes use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Any other failure exits `1`.

Tables created (owning service in parentheses):

|Table|Owner|Purpose|
| :-|:-:|:- |
|`frame_files`|[storage](../storage)|One row per saved motion frame (`camera`, `timestamp`, `name`, `size`)|
|`frame_deletes`|[storage](../storage)|Audit of quota-driven deletions (`camera`, `timestamp`, `size`, `count`)|
|`auth`|[command](../command)|Users: `username`, `hash`, `role`, `theme`, `force_password_change`, `temp_password_expires`, `last_login`|
|`sessions`|[command](../command)|Sessions keyed by `jti` (`ip`, `user_agent`, `revoked`), FK to `auth(username)` `ON DELETE CASCADE`|
|`objects_detected`|[object](../object)|Detections: `camera`, `timestamp`, `type`, `confidence`, `box` (JSONB), `image`|
|`task_runs`|[schedule](../schedule)|Scheduler run log: `task_id`, `url`, `status`, `http_status`, `error`, `ran_at`|

Supporting indexes: `idx_frame_files_camera_timestamp` on `frame_files(camera, timestamp)`, `idx_objects_detected_camera_timestamp` on `objects_detected(camera, timestamp)`, and `idx_task_runs_ran_at` on `task_runs(ran_at)`.

The module also exports `creationTasks` so tests can introspect the schema.

---
# preflight.js — `npm run preflight`

An interactive wizard that seeds and validates local config against the schema in [`../env.example`](../env.example) **before** you run Docker. It checks three things: `.env`, `motion.conf`, and `cameraconf/*.conf`.

```
npm run preflight            # interactive wizard (fixes problems in place)
npm run preflight -- --check # non-interactive report, exits 1 if blocked (CI)
```

Mode selection: `--check` forces the report-only path; it is also chosen automatically when stdin is not a TTY (unless `--interactive` is passed).

**.env** — in interactive mode, a missing `.env` is seeded from `env.example`; in `--check` mode a missing `.env` is reported as a failure (`.env ✗ missing`) that blocks Docker, with no seeding. Each schema key is then validated: required keys must be set (and not left at the placeholder), `(true | false)` keys must be `true`/`false`, and `_PORT`/`_PORT_SECURE` keys must be numeric. Interactive mode re-prompts until each value is valid and writes it back; `--check` lists every problem. Disabled services are skipped via the same `isServiceOff` rule as `validateEnvVars.js`, so you are never asked about a service whose `<prefix>_ON` is `false`.

**motion.conf** and **cameraconf/** are only checked when storage, object, or livestream is enabled. Interactive mode offers to copy `motion.conf.example` to `motion.conf`, then validates every camera `.conf` (parsed with [lib](../lib) `loadCameras.parseConf`) for a positive unique `camera_id`, a unique `camera_name`, and a `netcam_url` with a scheme (e.g. `rtsp://`), and can scaffold new `cameraconf/camN.conf` files. The camera directory defaults to `cameraconf/`; a **relative** `camera_dir` in `motion.conf` overrides it (resolved against the repo root), but an absolute `camera_dir` is ignored here and falls back to `cameraconf/`. (Note `loadCameras.js`, used by pm2, does honor an absolute `camera_dir`, so the two can disagree.)

Both paths exit `1` when anything is still unresolved (Docker blocked) and `0` when all checks pass. The module exports `parseSchema`, `typeOf`, `varProblem`, `cameraProblems`, and `isServiceOff` for reuse (notably by `validateEnvVars.js`) and testing.

---
# How it fits

- `validateEnvVars.js` and `prepareDatabase.js` are gates in the container boot chain (`entrypoint.sh`); pm2 only starts once both succeed.
- `preflight.js` runs on the host and shares its schema parsing and service-toggle logic with `validateEnvVars.js`, so host-side and container-side validation stay consistent.
- The env schema of record is [`../env.example`](../env.example); camera definitions live in `cameraconf/*.conf` and are parsed by [lib](../lib)/`utils/loadCameras.js`.
