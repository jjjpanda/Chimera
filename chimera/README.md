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

- Optional keys (`***` in [env.example](../env.example)) are skipped, as are a disabled service's `<prefix>_*` keys (its `<prefix>_ON` toggle is always checked), except where a cross-service rule below overrides.
- `object_ON=true` requires `livestream_ON=true` (why: [object](../object)); `livestream_PROXY_ON` is gateway routing and does not satisfy it.
- `storage_MOTION_CONF_FILEPATH` required only when storage/object/livestream is on.
- `storage_FOLDERPATH` (`objectCaptures/` out) and `livestream_FOLDERPATH` (frames in) are also required when `object_ON=true`, even with their own service off.
- `object_MODEL_SHA256` is required only once `object_MODEL_URL` is set. Without it object still starts but fails every scan on a retry backoff, so this check blocks boot instead.
- Re-reads the raw `.env` file (not `process.env`) for every key, to catch a `#` dotenv already truncated silently — see `preflight.js` below.
- Absolute-path checks: key/cert/ffmpeg/ffprobe files; `storage_FOLDERPATH` / `livestream_FOLDERPATH` folders. Only the folders are stat-confirmed, so a `_FILEPATH` naming a missing file still passes. `storage_MOTION_CONF_FILEPATH` skips the path check and is read-tested instead.
- An unparseable `gateway_HOST` blocks boot — the gateway builds its redirect target from it and never falls back to the `Host` header, so every `http://` request would answer `500`.
- Reprints preflight's redirect warnings. They never block boot.
- A `database_PASSWORD` under 32 characters now blocks boot. Postgres reads `POSTGRES_PASSWORD_FILE` only when it first initializes an empty `chimera-pgdata` volume, so lengthening the value in `.env` alone desyncs it from the stored password. Rotate the stored one first (`docker compose exec postgres psql -U "$database_USER" -c "ALTER USER \"$database_USER\" WITH PASSWORD '<new value>'"`), then restart — `npm run docker:delete` would also wipe the `chimera-storage` footage volume.

---
# prepareDatabase.js

Connects with `database_*` and runs each `CREATE TABLE`/`INDEX` once. An existing table (`42P07`) has its column names (not types) checked against `information_schema.columns` for the expected v6 shape; missing columns exit `1` and are listed. Indexes use `IF NOT EXISTS`. Any other error exits `1`. Exception: the `frame_files(camera, name)` unique index treats `23505` (pre-existing duplicate rows) as recoverable — it deletes the duplicates, keeping the lowest `id` per pair, logs the count, then retries. That delete is irreversible.

Tables (owner): `frame_files`, `frame_deletes` (storage) · `auth`, `sessions` (command) · `objects_detected` (object) · `task_runs`, `scheduled_tasks` (schedule). Plus seven indexes: `frame_files(camera, timestamp)`, `frame_files(timestamp)`, `frame_files(camera, name)` (unique), `objects_detected(camera, timestamp)`, `objects_detected(image)`, `task_runs(ran_at)`, and `sessions(username)`.

---
# preflight.js — `npm run preflight`

Interactive wizard that seeds and validates `.env`, `motion.conf`, and `cameraconf/*.conf` against [env.example](../env.example) before Docker.

```
npm run preflight            # interactive; fixes problems in place
npm run preflight -- --check # report-only, exits 1 if blocked (CI, non-TTY)
```

**`.env`** — interactive seeds a missing file from `env.example` and re-prompts until valid; `--check` only reports. Disabled services are skipped.

- Seeding blanks every right-hand side, since `env.example` holds a description rather than a value. A line whose comment starts with `# default` is the exception — that value is real (Docker paths, Postgres host and port), so it is copied as-is and never prompted for.
- Checks presence, types, ranges, formats, and secret length — 32+ for `SECRETKEY` and any `_AUTH` / `_TOKEN` / `_PASSWORD` key. Interactive offers a `crypto.randomBytes(32)` value for those and uses it on a blank Enter.
- Cross-checks:
  - `object_ON` requires `livestream_ON`.
  - `command_COOKIE_SECURE` must be `true` on an HTTPS deploy at a non-loopback host. It must be `false` when `gateway_HOST` carries an explicit `http://` prefix and neither `gateway_HTTPS_Redirect` nor `certbot_ON` is set.
  - `gateway_PORT` must be `80` when `certbot_ON=true`. Compose publishes no other port, so nothing else can answer the HTTP-01 challenge.
  - No two enabled services may share a port, `gateway_PORT` and `gateway_PORT_SECURE` included. The second to bind fails with `EADDRINUSE`.
- Value formats: `gateway_HOST` must parse as a URL and must bracket an IPv6 literal (`https://[::1]:8443`), or the port cannot be told apart from the address. `gateway_TRUST_PROXY` must be `true`, `false`, or the number of proxies in front. `storage_HOST` needs an explicit `http://` or `https://`.
- Redirect warnings — reported, never blocking — when `gateway_HTTPS_Redirect=true` and:
  - no certificate is reachable and `gateway_TRUST_PROXY` is off: every page redirects to itself (`ERR_TOO_MANY_REDIRECTS`). The pair is the two `FILEPATH`s when set, else `/etc/letsencrypt/live/<gateway_HOST hostname>/{privkey,fullchain}.pem` — IP literals included, since a hand-placed pair there works.
  - a cert path exists but this user cannot open it: unreadable is not proof of absent, so this replaces the loop warning.
  - `gateway_HOST` is `http://`, or names a port other than `gateway_PORT_SECURE`: the redirect lands where no TLS listens.
- No value may contain `#` — dotenv reads it as a comment. Checked on wizard answers and on values already in the file.
- The walk repeats until stable, since answering one key can unskip an earlier one. `livestream_ON`/`object_ON`, `gateway_HOST`/`command_COOKIE_SECURE`, and `certbot_ON`/`gateway_PORT` are re-asked as pairs — each is valid alone, so one pass would never revisit them.
- EOF (Ctrl-D) aborts with exit `1` and says whether anything was written. `.env` is written once, after the schema walk goes quiet, so aborting mid-walk leaves no half-filled file. Seeding and the motion.conf/camera prompts fall outside that write, so an abort there keeps a complete `.env` and any conf already created. Re-running picks up from disk.

**`motion.conf` / `cameraconf/`** — checked only when storage, object, or livestream is on.

- `motion.conf` must be a file, not just present. Compose bind-mounts that path unconditionally, so Docker creates a directory there when the file is missing.
- Validates each camera `.conf` (unique `camera_id` / `camera_name`, `netcam_url` scheme) and can scaffold new ones.
- An absolute `camera_dir` in `motion.conf` is ignored here but honored by `loadCameras.js` — the two can disagree.

**File permissions** — `.env` and `cameraconf/*.conf` are written `0640`, and existing camera confs are re-chmod'd on every interactive run.

- `--check` fails on a loose file even when its content is valid, so a plain `cp env.example .env` blocks `predocker:build` / `up` / `restart`.
- Interactive prints a `chown` hint when your gid isn't 1000, the uid the container runs as.

**At boot** — `validateEnvVars.js` re-runs all cross-checks and adds `*_URL` scheme and absolute-path checks. A build can pass preflight and still fail at boot.

Exits `1` when anything is unresolved. Exports helpers reused by `validateEnvVars.js` and tests.

---
# watchdog.js — `npm run watchdog`

Host-side liveness check, the only script here that keeps running after boot. It supervises nothing about itself, so both run modes need something outside it — a scheduler for `--once`, a systemd unit or pm2 for the self-polling mode. Operator setup for both is in the root [README](../README.md) under *Watchdog*.

```
npm run watchdog              # self-polling, every watchdog_INTERVAL_MS
npm run watchdog:once         # one pass, then exit — for a scheduler
npm run watchdog -- --dry-run # print the restart command, the reboot command and both URL sets, exit 0
```

**Polling** — two sets from [healthChecks.js](../lib/utils/healthChecks.js), both narrowed by `localOnly`, both with a 10s timeout.

| set | base | can restart or reboot |
|---|---|---|
| stack | `http://127.0.0.1:<gateway_PORT>` | yes |
| reachability | `gateway_HOST` | no — alert only |

- Only the loopback set arms an action. It skips DNS, TLS and anything proxying in front, so an outage between this host and the internet cannot reboot a recorder that is running fine.
- An unusable `gateway_PORT` is fatal at startup; an empty `gateway_HOST` only turns the alert off.
- A service is polled only with `<name>_PROXY_ON=true` *and* `<name>_ON=true`. `_PROXY_ON` alone means the gateway proxies it, not that it runs here — rebooting this host would never fix a fault on another machine. The [heartbeat](../heartbeat.config.js) keeps the wider map; it only alerts.
- Runs on the host: the heartbeat is a pm2 app inside `chimera` and dies with what it watches. Neither survives a kernel hang.
- Takes `.env` and the compose cwd from `preflight.js`'s `ENV`/`ROOT`, so a scheduler can run it from any directory.

**Escalation** — after `watchdog_FAILURES` consecutive failed polls, alternating stack restart and host reboot, indefinitely. Nothing powers the machine off.

- Reboots only when *every* endpoint failed. A partial outage is a container fault — `/object/health` answers in-band with inference and can outrun the poll timeout under load.
- The stage advances only on an action that worked. It is written before the action, so a reboot that kills the process still returns on `restart`; a restart the daemon refused rolls back.
- A healthy poll clears the failure count immediately, the stage only after `watchdog_FAILURES` healthy polls in a row — otherwise a fault a restart masks for a minute (wedged `docker0`, exhausted conntrack) never reaches the reboot that clears it.
- Restart is `docker compose up -d --force-recreate` through `compose.js`. Plain `restart` exits `0` doing nothing once `docker:down` or a half-finished `docker:rebuild` removed the containers. A daemon it cannot reach logs and exits `1` like a failed reboot, so an account outside the `docker` group is visible rather than silently escalating.
- Reboot is `systemctl reboot` (linux + systemd, detected by `/run/systemd/system`), `shutdown -r now` (linux without systemd, darwin), `shutdown /r /t 0` (win32), prefixed `sudo -n` for a non-root posix user. An unknown platform, missing binary, or non-zero exit sets exit code `1` and logs the reason without tearing the process down.
- The alert is awaited before the reboot, which is why `webhookAlert` returns its promise.
- `watchdog.state.json` holds `{ failures, healthy, stage, unreachable }` via `jsonFileHandling.js` — what makes `watchdog:once` work across runs. A write failure exits `1`, since a count that cannot persist never reaches the threshold.

**Config** — `watchdog_ON` must be `true`; anything else exits `0`. `watchdog_INTERVAL_MS` and `watchdog_FAILURES` default to `60000` and `3`.

- Preflight rejects a non-integer, a threshold below `1`, and an interval below `WATCHDOG_MIN_INTERVAL_MS` (5000) — `60` meaning seconds would poll every 60ms. `settings()` clamps to the same floor, since nothing runs preflight before `npm run watchdog`.
- Exits `1` rather than `0` on a config that cannot work — an unreadable `.env` whose settings are not in the environment either, an unusable `gateway_PORT` (relative paths `fetch` cannot parse, so every poll fails on a healthy host), or an empty poll set. Exit `0` would leave the operator believing the host is supervised.
- Startup prints preflight's `watchdogHostWarning` instead of running `preflight.js --check` as a `pre` hook, which would exit `1` on any unrelated env problem and make npm skip the watchdog itself.
- That warning reads `process.env` (`envLines()`), not `.env`: dotenv does not overwrite an already-set variable, so a systemd `Environment=` or exported shell var is what `settings()` and `checkUrl()` see. `composeArgs` reads the `certbot_ON` gate the same way, or a `certbot_ON=true` living in the unit would get `--scale certbot=0` on every watchdog restart and stop renewal.
- It covers both certificate traps: a scheme-less `gateway_HOST` (read as `https://`, so a plain-HTTP deploy fails every poll) and an explicit `https://` on a name no public CA issues for — an IP literal, a single label, or a `.lan`/`.local`/`.internal`/`.intranet`/`.home.arpa` suffix, where node's `fetch` rejects the self-signed certificate unless `NODE_EXTRA_CA_CERTS` points at the CA.
