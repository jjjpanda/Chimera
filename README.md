# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Microservices security-camera system for RTSP/IP cameras.

**Services:** [command](command) · [livestream](livestream) · [schedule](schedule) · [storage](storage) · [gateway](gateway) · [memory](memory) · [object](object)

**Shared:** [lib](lib) (utilities every service imports) · [chimera](chimera) (boot scripts: preflight wizard, env validation, schema creation)

**Bundled in the image:** [motion](https://github.com/Motion-Project/motion) (saves RTSP frames, with [storage](storage)) · [ffmpeg](https://ffmpeg.org) · [heartbeat](https://github.com/jjjpanda/heartbeat) · [postgres](https://www.postgresql.org) (own container)

---
# Quick start (Docker)

Bare-metal is unsupported. The image bundles motion, ffmpeg, Node, and pm2, and pins `TZ=UTC` (required — non-UTC misaligns clips/zips/frames).

```
cp env.example .env          # fill in values; leave optional fields blank after =
cp motion.conf.example motion.conf
# add a cameraconf/camN.conf per camera (see cameraconf/camera.conf.example)
npm run docker:build
npm run docker:up
```

- `npm run preflight` seeds and validates `.env` / `motion.conf` / `cameraconf/*.conf` before building; `docker:build`/`up` run it first, so a bad config blocks the build.
- `docker:logs` tails · `docker:down` stops · `docker:rebuild` redeploys · `docker:delete` wipes volumes.
- **First run:** no users exist — open the gateway and create the first admin from the setup screen (`POST /authorization/setup`, authorized with `setup_TOKEN`).

---
# Architecture

One Node process under pm2, fronted by a Postgres side container. Each service is toggled by `<prefix>_ON`; off means it never starts.

pm2 ([pm2.config.js](pm2.config.js)):
```
chimera  (server.js)   one process; runs all enabled services
motion                 storage_ON
ffmpeg × N             one HLS transcoder per camera, livestream_ON
heartbeat              production only
```

- [server.js](server.js) starts services in order: **command** (fatal on failure), storage, livestream, schedule, object, the **memory** socket, then the **gateway** last. The gateway is the only public entrypoint — reverse-proxies every `<prefix>_PROXY_ON=true` service and terminates TLS.
- Boot chain ([entrypoint.sh](entrypoint.sh), aborts on first failure): ACME dir → `validateEnvVars.js` → `prepareDatabase.js` → `pm2-runtime`.
- Postgres runs as a side container ([docker-compose.yml](docker-compose.yml)); Chimera waits on its healthcheck.
- TLS renewal: a `certbot` side container issues initial certs and renews them every 12h (HTTP-01 over the shared `acme-webroot` volume, mounted at the gateway's `/.well-known`); the gateway polls the cert mtime and self-restarts (via pm2) in the 3–4am UTC window to pick up new certs — except the very first cert issuance on a fresh deploy, which restarts immediately regardless of the window.
- `chimeraInstances`: `1` = single process; `>1`/`max` = cluster, which forces `memory_ON=true` so instances coordinate through the memory socket.

**Schema** ([prepareDatabase.js](chimera/prepareDatabase.js), created idempotently): `frame_files` / `frame_deletes` (storage) · `auth` / `sessions` (command) · `objects_detected` (object) · `task_runs` (schedule). Full config in [env.example](env.example).
