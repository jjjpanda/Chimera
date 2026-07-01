# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices-based security camera system for RTSP/IP cameras.

Microservices:

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)
7. [object](object)

Shared code & bootstrap:
- [lib](lib) - shared utilities for every service (auth middleware, webhook alerts, camera loading, etc.).
- [chimera](chimera) - boot/config scripts: `preflight.js` (config wizard), `validateEnvVars.js` (fail-fast env check), `prepareDatabase.js` (schema creation).

Bundled dependencies (in the Docker image):
1. [motion](https://github.com/Motion-Project/motion) - saves RTSP frames; co-located with [storage](storage).
2. [ffmpeg](https://ffmpeg.org) - used by [livestream](livestream) and [storage](storage).
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - confirms the server is up.
4. [postgres](https://www.postgresql.org) - the database (its own container).

## Quick Start (Docker)

The image bundles motion, ffmpeg, Node, and pm2, pins `TZ=UTC` (required; non-UTC misaligns clips/zips/frames), and runs Postgres as a side container whose schema is created automatically on boot.

### 1. Configure
```
cp env.example .env          # fill in values; leave optional fields blank after =
cp motion.conf.example motion.conf
```
Add a `cameraconf/camN.conf` per camera (see [`camera.conf.example`](cameraconf/camera.conf.example)).

Or run `npm run preflight` to interactively seed and validate `.env`, `motion.conf`, and `cameraconf/*.conf` against [`env.example`](env.example) before building; it skips checks for services you turned off. `docker:build`/`docker:up` run `preflight --check` first, so a bad config blocks the build.

### 2. Build & run
```
npm run docker:build
npm run docker:up
```
`docker:logs` tails · `docker:down` stops · `docker:rebuild` redeploys · `docker:delete` wipes volumes.

### 3. First run
No users exist on first boot. Open the gateway and create the first admin from the setup screen (calls `POST /authorization/setup`, authorized with `setup_TOKEN` from `.env`). Auth, RBAC, and sessions live in [command](command).

> Bare-metal is unsupported. Use Docker; pm2 on bare-metal is discouraged and undocumented.

## Architecture

- One Node process. [`server.js`](server.js) `require()`s and starts each service in order: command (fatal; process exits if it fails), storage, livestream, schedule, object (all via `.start()`), then the [memory](memory) socket (via `.server()`), then the [gateway](gateway) (via `.start()`). Each service is gated by its `<prefix>_ON` flag in `.env`; if off, it is not started.
- pm2 ([`pm2.config.js`](pm2.config.js)) manages one `chimera` app and launches `motion` (`storage_ON=true`), one `ffmpeg` HLS process per camera (`livestream_ON=true`), and `heartbeat` (production only). `chimeraInstances` sets the mode: `1` = single fork-mode process; `> 1` (or `max`) = cluster mode, which forces `memory_ON=true` so instances coordinate through the memory socket.
- Docker boot chain ([`entrypoint.sh`](entrypoint.sh)): create ACME challenge dir → `node chimera/validateEnvVars.js` (fail-fast on missing required env var) → `node chimera/prepareDatabase.js` (idempotently create tables/indexes) → `exec pm2-runtime pm2.config.js`.
- Postgres side container ([`docker-compose.yml`](docker-compose.yml)): Chimera image plus `postgres:15`; Chimera waits on its healthcheck before starting. `TZ=UTC` pinned on both, required.
- Schema ([`chimera/prepareDatabase.js`](chimera/prepareDatabase.js)): `frame_files`, `frame_deletes` (storage); `auth`, `sessions` (command auth/RBAC); `objects_detected` (object); `task_runs` (schedule); plus indexes.
- Gateway reverse-proxies each service with `<prefix>_PROXY_ON=true` and terminates TLS. See [`env.example`](env.example) for the full config schema.
