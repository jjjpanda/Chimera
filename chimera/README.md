# Chimera bootstrap <img src="../command/frontend/res/logo.png" alt="logo" width="20"/>

One-shot scripts that run before any service starts: validate config, prepare the Postgres schema, and (on the host) run a config wizard. No HTTP routes.

---
# Boot chain

[entrypoint.sh](../entrypoint.sh), the container entrypoint — runs in order, aborts on first failure (`set -e`):

1. `mkdir -p ./.well-known/acme-challenge` — ACME dir the [gateway](../gateway) serves for TLS.
2. `validateEnvVars.js` — fail-fast env validation.
3. `prepareDatabase.js` — create Postgres tables/indexes.
4. `exec pm2-runtime pm2.config.js` — hand off to pm2.

Preflight is not in this chain; it runs on the host before `docker compose up`.

---
# validateEnvVars.js

Checks every required env var — all checks run (no short-circuit), so one run reports every problem, then `exit(1)` if anything failed.

- Optional keys (`***` in [env.example](../env.example)) skipped; disabled services skip their `<prefix>_*` keys (the `<prefix>_ON` toggle is always checked).
- `storage_MOTION_CONF_FILEPATH` required only when storage/object/livestream is on.
- Absolute-path checks: key/cert/ffmpeg/ffprobe files; `storage_FOLDERPATH` / `livestream_FOLDERPATH` folders.

---
# prepareDatabase.js

Connects with `database_*` and runs each `CREATE TABLE`/`INDEX` once. An existing table (`42P07`) has its column names (not types) checked against `information_schema.columns` for the expected v6 shape — only a match is treated as success; missing columns exit `1` and list what's missing. Indexes use `IF NOT EXISTS`. Any other error exits `1`.

No v5 → v6 upgrade path: v6 changed the `auth` table shape, so a v5 database will fail this check. Run `npm run docker:delete` to drop the volume and start fresh.

Tables (owner): `frame_files`, `frame_deletes` (storage) · `auth`, `sessions` (command) · `objects_detected` (object) · `task_runs`, `scheduled_tasks` (schedule). Plus six indexes: `frame_files(camera, timestamp)`, `frame_files(timestamp)`, `objects_detected(camera, timestamp)`, `objects_detected(image)`, `task_runs(ran_at)`, and `sessions(username)`.

---
# preflight.js — `npm run preflight`

Interactive wizard that seeds and validates `.env`, `motion.conf`, and `cameraconf/*.conf` against [env.example](../env.example) before Docker.

```
npm run preflight            # interactive; fixes problems in place
npm run preflight -- --check # report-only, exits 1 if blocked (CI, non-TTY)
```

- `.env`: interactive seeds a missing file from `env.example` and re-prompts until valid; `--check` only reports. Validates required / boolean / port keys; skips disabled services.
- `motion.conf` / `cameraconf/`: checked only when storage/object/livestream is on. Validates each camera `.conf` (unique `camera_id` / `camera_name`, `netcam_url` scheme) and can scaffold new ones. An absolute `camera_dir` in `motion.conf` is ignored here (falls back to `cameraconf/`), but `loadCameras.js` (used by pm2) does honor it — the two can disagree.
- Exits `1` when anything is unresolved. Exports helpers reused by `validateEnvVars.js` and tests.
