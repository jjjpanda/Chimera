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
- `object_ON=true` requires `livestream_ON=true` (why: [object](../object)); `livestream_PROXY_ON` is gateway routing and does not satisfy it.
- `storage_MOTION_CONF_FILEPATH` required only when storage/object/livestream is on.
- `storage_FOLDERPATH` (`objectCaptures/` out) and `livestream_FOLDERPATH` (frames in) are also required when `object_ON=true`, even with their own service off.
- `object_MODEL_SHA256` is required only once `object_MODEL_URL` is set. Without the hash object refuses to load the model, but it still starts. It then fails each scan on a retry backoff, so this check blocks boot instead.
- Re-reads the raw `.env` file (not `process.env`) for every key to catch a `#` dotenv already silently truncated before parsing — see `preflight.js` below.
- Absolute-path checks: key/cert/ffmpeg/ffprobe files; `storage_FOLDERPATH` / `livestream_FOLDERPATH` folders. A `_FILEPATH` naming a file that does not exist still passes — only the folders are stat-confirmed. `storage_MOTION_CONF_FILEPATH` skips the path check entirely and is read-tested instead.
- Upgrading a deployment where `database_PASSWORD` is under 32 characters: this now blocks boot. Postgres only reads `POSTGRES_PASSWORD_FILE` on first init of an empty `chimera-pgdata` volume, so lengthening `database_PASSWORD` in `.env` alone desyncs it from the password already stored in Postgres. Rotate the stored password to match first (e.g. `docker compose exec postgres psql -U "$database_USER" -c "ALTER USER \"$database_USER\" WITH PASSWORD '<new value>'"`) before restarting with the new value — `npm run docker:delete` also wipes the `chimera-storage` footage volume.

---
# prepareDatabase.js

Connects with `database_*` and runs each `CREATE TABLE`/`INDEX` once. An existing table (`42P07`) has its column names (not types) checked against `information_schema.columns` for the expected v6 shape — only a match is treated as success; missing columns exit `1` and list what's missing. Indexes use `IF NOT EXISTS`. Any other error exits `1`. Exception: the `frame_files(camera, name)` unique index treats `23505` (pre-existing duplicate rows) as recoverable — it deletes the duplicates, keeping the lowest `id` per pair, logs how many rows it removed, then retries the index creation. That delete is irreversible.

Tables (owner): `frame_files`, `frame_deletes` (storage) · `auth`, `sessions` (command) · `objects_detected` (object) · `task_runs`, `scheduled_tasks` (schedule). Plus seven indexes: `frame_files(camera, timestamp)`, `frame_files(timestamp)`, `frame_files(camera, name)` (unique), `objects_detected(camera, timestamp)`, `objects_detected(image)`, `task_runs(ran_at)`, and `sessions(username)`.

---
# preflight.js — `npm run preflight`

Interactive wizard that seeds and validates `.env`, `motion.conf`, and `cameraconf/*.conf` against [env.example](../env.example) before Docker.

```
npm run preflight            # interactive; fixes problems in place
npm run preflight -- --check # report-only, exits 1 if blocked (CI, non-TTY)
```

**`.env`** — interactive seeds a missing file from `env.example` and re-prompts until valid; `--check` only reports. Disabled services are skipped.

- Seeding blanks every right-hand side, since `env.example` holds a description of the value rather than a value. The exception is a line whose comment starts with `# default` — that value is real (the Docker paths, the Postgres host and port), so it is copied through as-is and never prompted for. `parseSchema` gives those keys an empty `placeholder`, which is what stops `varProblem` reading a correctly-filled default as unset.
- Checks presence, types, ranges, formats, and secret length — 32+ for `SECRETKEY` and any `_AUTH` / `_TOKEN` / `_PASSWORD` key. Interactive offers a `crypto.randomBytes(32)` value for those keys and uses it on a blank Enter, instead of re-prompting.
- Cross-checks: `object_ON` requires `livestream_ON`; `command_COOKIE_SECURE` must be `true` on an HTTPS deploy at a non-loopback host, so a loopback `gateway_HOST` is never flagged; `command_COOKIE_SECURE` must be `false` when `gateway_HOST` carries an explicit `http://` prefix and neither `gateway_HTTPS_Redirect` nor `certbot_ON` is `true`; `gateway_PORT` must be `80` when `certbot_ON=true` (compose publishes only `gateway_PORT`, so an HTTP-01 challenge on any other port never arrives); and no two enabled services (including `gateway_PORT` / `gateway_PORT_SECURE`) may share a port — they're separate pm2 apps in the same container network namespace, so the second to bind loses with `EADDRINUSE`.
- No value may contain `#` — dotenv reads it as a comment. Checked on wizard answers and on values already in the file.
- The walk repeats until stable, since answering one key can unskip an earlier one. `livestream_ON`/`object_ON`, `gateway_HOST`/`command_COOKIE_SECURE`, and `certbot_ON`/`gateway_PORT` are re-asked as pairs — each is valid alone, so one pass would never revisit them.
- EOF (Ctrl-D) at any prompt aborts with exit `1`, and says whether anything was written. The schema walk writes `.env` once, after it goes quiet, so aborting mid-walk leaves no half-filled file — but seeding happens before the first prompt, and the motion.conf and camera prompts come after that write, so an abort there keeps a complete `.env` and any conf already created. Re-running picks up from what is on disk.

**`motion.conf` / `cameraconf/`** — checked only when storage, object, or livestream is on.

- `motion.conf` must be a file, not just present. Compose bind-mounts that path unconditionally, so Docker creates a directory there when the file is missing.
- Validates each camera `.conf` (unique `camera_id` / `camera_name`, `netcam_url` scheme) and can scaffold new ones.
- An absolute `camera_dir` in `motion.conf` is ignored here but honored by `loadCameras.js` — the two can disagree.

**File permissions** — `.env` and `cameraconf/*.conf` are written `0640`, and existing camera confs are re-chmod'd on every interactive run.

- `--check` fails on a loose file even when its content is valid, so a plain `cp env.example .env` blocks `predocker:build` / `up` / `restart`.
- Interactive prints a `chown` hint when your gid isn't 1000, the uid the container runs as.

**At boot** — `validateEnvVars.js` re-runs all cross-checks and adds `*_URL` scheme and absolute-path checks. A build can pass preflight and still fail at boot.

Exits `1` when anything is unresolved. Exports helpers reused by `validateEnvVars.js` and tests.
