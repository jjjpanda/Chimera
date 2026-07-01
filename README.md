# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices-based security camera system for RTSP/IP cameras.

List of microservices: 

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)
7. [object](object)

Shared code & bootstrap:
- [lib](lib) - shared utilities used by every service (auth middleware, webhook alerts, camera loading, etc.).
- [chimera](chimera) - boot/config scripts: `preflight.js` (config wizard), `validateEnvVars.js` (fail-fast env check), `prepareDatabase.js` (schema creation).

Massive Dependencies (all bundled in the Docker image):
1. [motion](https://github.com/Motion-Project/motion) - saves RTSP frames; co-located with [storage](storage), see why there.
2. [ffmpeg](https://ffmpeg.org) - used by [livestream](livestream) and [storage](storage).
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - confirms the server is still up.
4. [postgres](https://www.postgresql.org) - the database (runs as its own container).

## Quick Start (Docker)

Docker is the supported way to run Chimera. The image bundles motion, ffmpeg, Node, and pm2, pins `TZ=UTC` (required — non-UTC misaligns clips/zips/frames), and runs Postgres as a side container whose schema is created automatically on boot.

### 1. Configure
```
cp env.example .env          # fill in values; leave optional fields blank after =
cp motion.conf.example motion.conf
```
Add a `cameraconf/camN.conf` per camera (see [`camera.conf.example`](cameraconf/camera.conf.example)).

Or run `npm run preflight` to interactively seed and validate `.env`, `motion.conf`, and `cameraconf/*.conf` against [`env.example`](env.example) before building. It skips checks for services you have turned off. `docker:build`/`docker:up` already run `preflight --check` first, so a bad config blocks the build.

### 2. Build & run
```
npm run docker:build
npm run docker:up
```
`docker:logs` tails output · `docker:down` stops · `docker:rebuild` redeploys · `docker:delete` wipes volumes.

### 3. First run
On first boot no users exist. Open the gateway in a browser and create the first admin from the setup screen, which calls `POST /authorization/setup`. The call is authorized with the required `setup_TOKEN` from `.env`. Auth, RBAC, and sessions all live in [command](command).

> **Bare-metal is unsupported.** Please use Docker. Running via pm2 on bare-metal is heavily discouraged and no longer documented.

## Architecture

- **One Node process.** [`server.js`](server.js) `require()`s each service and starts them in order: command (fatal — the process exits if it fails), storage, livestream, schedule, object — all via `.start()` — then the [memory](memory) socket (via `.server()`), then the [gateway](gateway) (via `.start()`). Each service is gated by its own `<prefix>_ON` flag in `.env`, so a service left off is simply not started.
- **pm2 is the process manager** ([`pm2.config.js`](pm2.config.js)). It runs that single `chimera` app and, alongside it, launches `motion` (when `storage_ON=true`), one `ffmpeg` HLS process per camera (when `livestream_ON=true`), and `heartbeat` (production only). `chimeraInstances` sets the pm2 mode: `1` runs a single fork-mode process, while `> 1` (or `max`) switches to cluster mode and forces `memory_ON=true` so instances stay coordinated through the memory socket.
- **Docker boot chain** ([`entrypoint.sh`](entrypoint.sh)): create the ACME challenge dir → `node chimera/validateEnvVars.js` (fail-fast if a required env var is missing) → `node chimera/prepareDatabase.js` (idempotently create tables/indexes) → `exec pm2-runtime pm2.config.js`.
- **Postgres side container.** [`docker-compose.yml`](docker-compose.yml) runs the Chimera image plus a `postgres:15` container; Chimera waits on its healthcheck before starting. `TZ=UTC` is pinned on both containers and is required.
- **Schema** (created by [`chimera/prepareDatabase.js`](chimera/prepareDatabase.js)): `frame_files`, `frame_deletes` (storage); `auth`, `sessions` (command auth/RBAC); `objects_detected` (object); `task_runs` (schedule); plus supporting indexes.
- **Single public entrypoint.** The [gateway](gateway) reverse-proxies each service whose `<prefix>_PROXY_ON=true` and terminates TLS. See [`env.example`](env.example) for the full configuration schema.
