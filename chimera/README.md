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

- Optional keys (`***` in [env.example](../env.example)) skipped; disabled services skip their `<prefix>_*` keys (the `<prefix>_ON` toggle is always checked), except where a cross-service rule below overrides.
- `object_ON=true` requires `livestream_ON=true` — object's only frame source is `livestream_FOLDERPATH/feed/<id>/video.m3u8`, and pm2 starts the per-camera ffmpeg writers only for livestream. `livestream_PROXY_ON` is gateway routing and does not satisfy it.
- `storage_MOTION_CONF_FILEPATH` required only when storage/object/livestream is on.
- `storage_FOLDERPATH` (`objectCaptures/` out) and `livestream_FOLDERPATH` (frames in) are also required when `object_ON=true`, even with their own service off.
- Re-reads the raw `.env` file (not `process.env`) for every key to catch a `#` dotenv already silently truncated before parsing — see `preflight.js` below.
- Absolute-path checks: key/cert/ffmpeg/ffprobe files; `storage_FOLDERPATH` / `livestream_FOLDERPATH` folders.

---
# prepareDatabase.js

Connects with `database_*` and runs each `CREATE TABLE`/`INDEX` once. An existing table (`42P07`) has its column names (not types) checked against `information_schema.columns` for the expected v6 shape — only a match is treated as success; missing columns exit `1` and list what's missing. Indexes use `IF NOT EXISTS`. Any other error exits `1`.

Tables (owner): `frame_files`, `frame_deletes` (storage) · `auth`, `sessions` (command) · `objects_detected` (object) · `task_runs`, `scheduled_tasks` (schedule). Plus six indexes: `frame_files(camera, timestamp)`, `frame_files(timestamp)`, `objects_detected(camera, timestamp)`, `objects_detected(image)`, `task_runs(ran_at)`, and `sessions(username)`.

---
# preflight.js — `npm run preflight`

Interactive wizard that seeds and validates `.env`, `motion.conf`, and `cameraconf/*.conf` against [env.example](../env.example) before Docker.

```
npm run preflight            # interactive; fixes problems in place
npm run preflight -- --check # report-only, exits 1 if blocked (CI, non-TTY)
```

- `.env`: interactive seeds a missing file from `env.example` and re-prompts until valid; `--check` only reports. Validates presence, boolean / port type, and `storage_HOST` scheme; skips disabled services. No value may contain `#` — dotenv reads it as a comment and drops the rest of the line; this is checked for wizard answers and for values already sitting in the file (hand-edited or left over from a previous run), not just fresh input. The walk repeats until stable, since answering one key can unskip an earlier one, and forces a re-ask of `livestream_ON` / `object_ON` while that pair stays inconsistent.
- `motion.conf` / `cameraconf/`: checked only when storage/object/livestream is on. Validates each camera `.conf` (unique `camera_id` / `camera_name`, `netcam_url` scheme) and can scaffold new ones. An absolute `camera_dir` in `motion.conf` is ignored here (falls back to `cameraconf/`), but `loadCameras.js` (used by pm2) does honor it — the two can disagree.
- Preflight checks presence, type, and format only. Deeper checks run container-side at boot in `validateEnvVars.js`, not here: `SECRETKEY` length (>= 32), `*_URL` scheme (`alert_URL`, `admin_alert_URL`, `object_MODEL_URL`), and the absolute-path checks above. Those path checks are narrower than they sound: a `_FOLDERPATH` must name an existing directory, but a `_FILEPATH` pointing at a missing file passes — only a relative path or a directory fails. Readability is read-tested for `.env` and `storage_MOTION_CONF_FILEPATH` only, and both ignore a missing file. A build can pass preflight and still fail the boot check for those classes.
- Exits `1` when anything is unresolved. Exports helpers reused by `validateEnvVars.js` and tests.
