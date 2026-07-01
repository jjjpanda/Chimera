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

One Node process under pm2, fronted by a Postgres side container. Each service is toggled by its `<prefix>_ON` flag in `.env`; if off, it never starts.

**Process tree** — pm2 ([`pm2.config.js`](pm2.config.js)) runs the Node app plus a few native helpers:

```
pm2
├─ chimera  (server.js)   one process; runs all enabled services
├─ motion                 storage_ON
├─ ffmpeg × N             one HLS transcoder per camera, livestream_ON
└─ heartbeat              production only
```

Inside `chimera`, [`server.js`](server.js) starts services in order: **command** first (fatal — the process exits if it fails), then **storage**, **livestream**, **schedule**, **object**, then the **memory** coordination socket, then the **gateway** last. The gateway is the single public entrypoint: it reverse-proxies every service with `<prefix>_PROXY_ON=true` and terminates TLS.

**Boot chain** — Docker [`entrypoint.sh`](entrypoint.sh) runs before pm2, aborting on the first failure:

```
ACME dir → validateEnvVars.js → prepareDatabase.js → pm2-runtime
 (TLS)     (fail-fast env)       (create schema)      (start pm2)
```

Postgres runs as a side container ([`docker-compose.yml`](docker-compose.yml), `postgres:15`); Chimera waits on its healthcheck. `TZ=UTC` is pinned on both and is required — non-UTC misaligns clips, zips, and frames.

**Single vs. cluster** — `chimeraInstances` picks the mode: `1` is a single fork-mode process; `>1` or `max` is cluster mode, which forces `memory_ON=true` so instances coordinate through the memory socket.

**Schema** — [`prepareDatabase.js`](chimera/prepareDatabase.js) idempotently creates these tables (plus indexes), per owning service:

- **storage** — `frame_files`, `frame_deletes`
- **command** — `auth`, `sessions`
- **object** — `objects_detected`
- **schedule** — `task_runs`

See [`env.example`](env.example) for the full config schema.
