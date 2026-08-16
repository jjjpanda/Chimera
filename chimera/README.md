# Chimera bootstrap <img src="../command/frontend/res/logo.png" alt="logo" width="20"/>

Scripts that run before any service starts, plus `watchdog.js` which keeps running. No HTTP routes.

---
# Boot chain

[entrypoint.sh](../entrypoint.sh) runs these in order inside the container, stopping on the first failure:

1. `mkdir -p ./.well-known/acme-challenge` — ACME dir for TLS.
2. `validateEnvVars.js` — env validation.
3. `prepareDatabase.js` — Postgres tables and indexes.
4. `exec pm2-runtime pm2.config.js` — hand off to pm2.

`preflight.js` is not in this chain — it runs on the host before `docker compose up`.

---
# validateEnvVars.js

Runs every check before exiting, so one run reports all problems. Re-reads the raw `.env` (not `process.env`) to catch values dotenv truncated at `#`.

Traps:
- `object_ON` requires `livestream_ON` and both `_FOLDERPATH`s.
- `database_PASSWORD` must be 32+ chars. Postgres only reads it when the volume is first created, so changing `.env` alone desyncs the password. You must `ALTER USER` in Postgres first.

---
# prepareDatabase.js

Creates tables and indexes, then checks for expected v6 columns (exits `1` if missing).

Tables: `frame_files`, `frame_deletes`, `auth`, `sessions`, `objects_detected`, `task_runs`, `scheduled_tasks`.

**Irreversible:** if the unique index on `frame_files(camera, name)` fails, duplicate rows are deleted (lowest `id` kept) and it retries.

---
# preflight.js — `npm run preflight`

Host-side wizard that seeds and validates `.env` and camera configs against [env.example](../env.example).

```
npm run preflight            # interactive, fixes in place
npm run preflight -- --check # CI mode, exits 1 if blocked
```

- Seeds blank values from `env.example`. Lines marked `# default` are copied as-is.
- Secrets need 32+ chars. Blank Enter generates one.
- Some keys are validated in pairs (e.g. `certbot_ON`/`gateway_PORT` must be `80`).
- No value may contain `#`.
- Files are written `0640` — a loose-permission file blocks `--check` even if valid.

`validateEnvVars.js` re-runs all of this at boot and adds more, so passing preflight does not guarantee boot.

---
# watchdog.js — `npm run watchdog`

Host-side liveness check. Does not supervise itself — install it as a boot service with `npm run watchdog:install`. Setup is in the root [README](../README.md) under *Watchdog*.

```
npm run watchdog              # self-polling
npm run watchdog:once         # one pass, then exit
npm run watchdog:install      # generate boot service config
npm run watchdog -- --dry-run # print what it would do
```

**Polling** — two URL sets from [healthChecks.js](../lib/utils/healthChecks.js):

| set | base | can act |
|---|---|---|
| stack | `127.0.0.1:<gateway_PORT>` | restart / reboot |
| reachability | `gateway_HOST` | alert only |

Only the loopback set triggers actions — an internet outage cannot reboot a working recorder.

**Escalation** — after `watchdog_FAILURES` consecutive failures, alternates between container restart (`docker compose up -d --force-recreate`) and host reboot. State persists in `watchdog.state.json`, which is how `--once` carries context between runs.

**Config** — bad config exits `1` (not `0`) so the operator knows supervision is down. The watchdog reads `process.env`, not `.env` — a systemd `Environment=` line is what it actually sees.

**Updates** — the admin panel triggers `git pull` + `docker:rebuild` through the watchdog, because `command` runs inside the container with no Docker socket or host shell. Communication happens via files in `chimera-update/`, defined in [updateBridge.js](../lib/utils/updateBridge.js):

| file | writer | meaning |
|---|---|---|
| `heartbeat.json` | watchdog | proves the watchdog is alive; the panel enables the Update button when this is fresh |
| `request.json` | command | admin asked for an update |
| `running.json` | watchdog | pull or rebuild in progress |
| `result.json` | watchdog | outcome of the last update |
| `version.json` | watchdog | local vs upstream version |

- There is no cancel — the confirm dialog is the only decision point.
- A `running.json` at startup means the watchdog was killed mid-rebuild; it is closed as a failure.
- The directory must be writable by uid 1000 (being in `docker` group is not enough).

**Versions** — compares `git show <upstream>:package.json` against local, refreshed hourly. Major bumps require explicit opt-in (`allowMajor`); minor bumps are named in the dialog; patches are silent.
