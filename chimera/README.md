# Chimera bootstrap <img src="../command/frontend/res/logo.png" alt="logo" width="20"/>

One-shot bootstrap scripts that run before any service starts: they validate config, prepare the Postgres schema, and (on the host, before Docker) run a config wizard; no HTTP routes.

---
# Boot chain

`entrypoint.sh` is the container entrypoint. It runs in order and aborts on the first failure (`set -e`):

1. `mkdir -p ./.well-known/acme-challenge` — ACME challenge dir the [gateway](../gateway) serves for TLS cert issuance.
2. `node chimera/validateEnvVars.js` — fail-fast validation of required env vars.
3. `node chimera/prepareDatabase.js` — idempotently create Postgres tables and indexes.
4. `exec pm2-runtime pm2.config.js` — hand off to pm2 ([`../pm2.config.js`](../pm2.config.js)).

pm2 launches:

- `server.js` (Chimera): single instance when `chimeraInstances == 1`; cluster of `chimeraInstances` when `>1` or `max` (forces `memory_ON=true`).
- `motion` when `storage_ON=true`.
- one `ffmpeg` HLS process per camera when `livestream_ON=true`.
- `heartbeat` in production.

Preflight is not part of this chain; it runs on the host before `docker compose up`.

---
# validateEnvVars.js

Loads `.env` via `dotenv` and checks every required var. All checks run unconditionally (no short-circuit): each missing or invalid var prints its own message (`MISSING ENV VAR <name>`, or `SHOULD BE AN ABSOLUTE PATH` / `SHOULD BE A FOLDER` / `SHOULD BE A FILE`), so one run reports every problem. Calls `process.exit(1)` once at the end if anything failed, so the container never boots half-configured.

- Optional keys (`***` in [`../env.example`](../env.example)) are skipped; `optionalKeys` comes from `preflight.parseSchema`.
- Disabled services skip their checks via `preflight.isServiceOff`: a key prefixed `command_`, `schedule_`, `storage_`, `livestream_`, `object_`, `memory_`, or `gateway_` is skipped when its `<prefix>_ON` is `false`. The `<prefix>_ON` toggle itself is always checked. `storage_MOTION_CONF_FILEPATH` is required only when storage, object, or livestream is on.
- Path checks (`confirmPath()`), all must be absolute: `privateKey_FILEPATH`, `certificate_FILEPATH`, `ffmpeg_FILEPATH`, `ffprobe_FILEPATH` must be files; `storage_FOLDERPATH`, `livestream_FOLDERPATH` must be folders.

---
# prepareDatabase.js

Connects with the `database_*` env vars and runs each `CREATE TABLE` / `CREATE INDEX` once. Idempotent: an existing table surfaces `42P07` (`relation already exists`), treated as success; indexes use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Any other failure exits `1`. Exports `creationTasks` so tests can introspect the schema.

Tables created (owning service in parentheses):

|Table|Owner|Purpose|
| :-|:-:|:- |
|`frame_files`|[storage](../storage)|One row per saved motion frame (`camera`, `timestamp`, `name`, `size`)|
|`frame_deletes`|[storage](../storage)|Audit of quota-driven deletions (`camera`, `timestamp`, `size`, `count`)|
|`auth`|[command](../command)|Users: `username`, `hash`, `role`, `theme`, `force_password_change`, `temp_password_expires`, `last_login`|
|`sessions`|[command](../command)|Sessions keyed by `jti` (`ip`, `user_agent`, `revoked`), FK to `auth(username)` `ON DELETE CASCADE`|
|`objects_detected`|[object](../object)|Detections: `camera`, `timestamp`, `type`, `confidence`, `box` (JSONB), `image`|
|`task_runs`|[schedule](../schedule)|Scheduler run log: `task_id`, `url`, `status`, `http_status`, `error`, `ran_at`|

Indexes: `idx_frame_files_camera_timestamp` on `frame_files(camera, timestamp)`, `idx_objects_detected_camera_timestamp` on `objects_detected(camera, timestamp)`, `idx_task_runs_ran_at` on `task_runs(ran_at)`.

---
# preflight.js — `npm run preflight`

Interactive wizard that seeds and validates local config against [`../env.example`](../env.example) before Docker. Checks `.env`, `motion.conf`, and `cameraconf/*.conf`.

```
npm run preflight            # interactive wizard (fixes problems in place)
npm run preflight -- --check # non-interactive report, exits 1 if blocked (CI)
```

- Mode: `--check` forces report-only; also used automatically when stdin is not a TTY, unless `--interactive` is passed.
- `.env`: interactive mode seeds a missing `.env` from `env.example`; `--check` reports it as `.env ✗ missing` (blocks Docker, no seeding). Each key is validated: required keys must be set (not left at the placeholder), `(true | false)` keys must be `true`/`false`, `_PORT`/`_PORT_SECURE` keys must be numeric. Interactive re-prompts until valid and writes back; `--check` lists every problem. Disabled services are skipped via `isServiceOff`.
- `motion.conf` / `cameraconf/`: checked only when storage, object, or livestream is on. Interactive offers to copy `motion.conf.example` to `motion.conf`, validates every camera `.conf` (parsed with [lib](../lib) `loadCameras.parseConf`) for a positive unique `camera_id`, a unique `camera_name`, and a `netcam_url` with a scheme (e.g. `rtsp://`), and can scaffold new `cameraconf/camN.conf`. Camera dir defaults to `cameraconf/`; a relative `camera_dir` in `motion.conf` overrides it (resolved against repo root), but an absolute `camera_dir` is ignored here and falls back to `cameraconf/`. (`loadCameras.js`, used by pm2, does honor an absolute `camera_dir`, so the two can disagree.)
- Exits `1` when anything is unresolved (Docker blocked), `0` when all checks pass. Exports `parseSchema`, `typeOf`, `varProblem`, `cameraProblems`, `isServiceOff` for reuse (notably `validateEnvVars.js`) and testing.
