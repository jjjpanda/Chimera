# Chimera bootstrap <img src="../command/frontend/res/logo.png" alt="logo" width="20"/>

Scripts that run before any service starts — validate config, prepare the Postgres schema, run a setup wizard — plus `watchdog.js`, the only one that keeps running. No HTTP routes.

---
# Boot chain

[entrypoint.sh](../entrypoint.sh) runs these inside the container, in order, aborting on the first failure:

1. `mkdir -p ./.well-known/acme-challenge` — ACME dir the [gateway](../gateway) serves for TLS.
2. `validateEnvVars.js` — env validation.
3. `prepareDatabase.js` — Postgres tables and indexes.
4. `exec pm2-runtime pm2.config.js` — hand off to pm2.

`preflight.js` is not in this chain. It runs on the host, before `docker compose up`.

---
# validateEnvVars.js

The last gate before pm2 starts. Every check runs before it exits `1`, so one run reports every problem. Disabled services and optional keys are skipped unless a cross-service rule needs them. It re-reads the raw `.env` rather than `process.env`, to catch a `#` dotenv already truncated.

The rules that surprise people:

- `object_ON` needs `livestream_ON` — it reads the frames livestream writes. Gateway routing (`livestream_PROXY_ON`) does not count.
- `object_ON` also needs both `_FOLDERPATH`s, even with those services off.
- `database_PASSWORD` under 32 characters blocks boot. Postgres reads the password only when it first creates its volume, so editing `.env` alone desyncs the two. Rotate the stored one first — `ALTER USER "<database_USER>" WITH PASSWORD '<new>'` — then restart. `npm run docker:delete` would wipe recorded footage along with it.

---
# prepareDatabase.js

Creates each table and index once, then checks an existing table for the expected v6 columns; missing ones exit `1`.

Owners: `frame_files`, `frame_deletes` (storage) · `auth`, `sessions` (command) · `objects_detected` (object) · `task_runs`, `scheduled_tasks` (schedule).

One step is irreversible: if the unique index on `frame_files(camera, name)` cannot be built, duplicate rows are deleted — lowest `id` per pair kept — and it retries.

---
# preflight.js — `npm run preflight`

Host-side wizard that seeds and validates `.env`, `motion.conf` and `cameraconf/*.conf` against [env.example](../env.example), before Docker.

```
npm run preflight            # interactive; fixes problems in place
npm run preflight -- --check # report only, exits 1 if blocked (CI, non-TTY)
```

- Seeding blanks every value, since `env.example` holds descriptions. Lines marked `# default` are real values and are copied as-is.
- Secrets — `SECRETKEY` and any `_AUTH` / `_TOKEN` / `_PASSWORD` — need 32+ characters. A blank Enter takes a generated one.
- Keys that cannot be judged alone are asked as pairs: `object_ON`/`livestream_ON`, `gateway_HOST`/`command_COOKIE_SECURE`, and `certbot_ON`/`gateway_PORT` (which must be `80` — compose publishes no other port for the ACME challenge). Two enabled services may not share a port.
- No value may contain `#`; dotenv truncates there.
- The walk repeats until stable, since answering one key can unskip another. `.env` is written once at the end, so Ctrl-D mid-walk leaves no half-filled file.
- HTTPS-redirect problems warn, never block: an unreachable certificate, an unreadable one, or a `gateway_HOST` pointing where no TLS listens.
- `.env` and camera confs are written `0640`. `--check` fails on a loose file even when its content is valid, so a plain `cp env.example .env` blocks `docker:build`.

`validateEnvVars.js` re-runs all of this at boot and adds more, so a build can pass preflight and still fail at boot.

---
# watchdog.js — `npm run watchdog`

Host-side liveness check. It does not supervise itself: `--once` needs a scheduler, self-polling needs systemd or pm2. Operator setup is in the root [README](../README.md) under *Watchdog*.

```
npm run watchdog              # self-polling, every watchdog_INTERVAL_MS
npm run watchdog:once         # one pass, then exit
npm run watchdog -- --dry-run # print what it would run, exit 0
```

**Polling** — two URL sets from [healthChecks.js](../lib/utils/healthChecks.js), 10s timeout each.

| set | base | can restart or reboot |
|---|---|---|
| stack | `http://127.0.0.1:<gateway_PORT>` | yes |
| reachability | `gateway_HOST` | no — alert only |

Only the loopback set arms an action, so an outage between this host and the internet cannot reboot a recorder that is running fine. A service is polled only with both `<name>_ON` and `<name>_PROXY_ON` — proxying alone means it runs on some other machine.

**Escalation** — after `watchdog_FAILURES` failed polls in a row, alternating stack restart and host reboot, indefinitely. Nothing powers the machine off.

- Reboot only when *every* endpoint failed. A partial outage is a container fault.
- The stage advances only on an action that worked, and is written before the action, so a reboot that kills the process still comes back on `restart`.
- A healthy poll clears the failure count at once, the stage only after a full run of healthy polls — a fault a restart hides for a minute must still reach the reboot that clears it.
- Restart is `docker compose up -d --force-recreate`. Plain `restart` would exit `0` doing nothing after a `docker:down`.
- Reboot is `systemctl reboot`, `shutdown -r now` or `shutdown /r /t 0` by platform, prefixed `sudo -n` for a non-root posix user.
- `watchdog.state.json` carries the counts between runs, which is what makes `watchdog:once` work.

**Config** — `watchdog_ON` must be `true`. `watchdog_INTERVAL_MS` and `watchdog_FAILURES` default to `60000` and `3`, with a 5s floor on the interval.

A config that cannot work exits `1`, not `0` — exit `0` would leave an operator believing the host is supervised. Startup only prints preflight's host warning rather than running `--check`, which would make npm skip the watchdog over any unrelated env problem. That warning reads `process.env`, not `.env`: dotenv never overwrites an already-set variable, so a systemd `Environment=` line is what the watchdog actually sees.

**Updates** — the admin panel's update button runs `git pull` and `npm run docker:rebuild` here. `command` cannot: it lives inside the container, with no Docker socket, no host shell and no checkout. It drops a file in the shared `chimera-update/` directory instead, named for both sides in [updateBridge.js](../lib/utils/updateBridge.js).

| file | written by | means |
|---|---|---|
| `request.json` | `command` | an admin asked; nothing has started |
| `running.json` | watchdog | the pull or rebuild is running now |
| `result.json` | watchdog | outcome of the last one that finished |
| `version.json` | watchdog | local checkout against the upstream branch |

- Three states, not two. A rebuild takes minutes and takes the panel down with it, so a returning panel must not read an old `result.json` as this update's outcome.
- There is no cancel. The confirm dialog is the only decision point.
- A `running.json` found at the start of a pass is therefore a watchdog killed mid-rebuild, closed as a failure. Check `git log` and `docker compose ps` before retrying.
- The directory is owned by uid 1000, so the host account running the watchdog must be able to write it. Being in the `docker` group is not enough.
- Nothing happens without `watchdog_ON=true`. Nothing else reads the directory.

**Versions** — `git show <upstream>:package.json` against the local one, published hourly and re-read when a request arrives, so the panel's warning can be stale but the refusal cannot. **Major** bumps are refused until the request carries `allowMajor`, the panel's checkbox; **minor** is named in the dialog; **patch** is silent. An unknown version on either end gates nothing.
