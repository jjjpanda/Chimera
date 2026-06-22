# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices-based security camera system for RTSP/IP cameras (Linux only).

List of microservices: 

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)
7. [object](object)

Massive Dependencies (all bundled in the Docker image):
1. [motion](https://github.com/Motion-Project/motion) - saves RTSP frames; co-located with [storage](storage), see why there.
2. [ffmpeg](https://ffmpeg.org) - used by [livestream](livestream) and [storage](storage).
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - confirms the server is still up.
4. [postgres](https://www.postgresql.org) - the database (runs as its own container).

## Quick Start (Docker)

Docker is the supported way to run Chimera. The image bundles motion, ffmpeg, Node, and pm2, pins `TZ=UTC` (required — frame timestamps and the UI both assume UTC), and runs Postgres as a side container whose schema is created automatically on boot.

### 1. Configure
```
cp env.example .env          # fill in values; leave optional fields blank after =
cp motion.conf.example motion.conf
```
Add a `cameraconf/camN.conf` per camera (see [`motion.conf.example`](motion.conf.example)).

### 2. Build & run
```
npm run docker:build
npm run docker:up
```
`docker:logs` tails output · `docker:down` stops · `docker:rebuild` redeploys · `docker:delete` wipes volumes.

> **Bare-metal is unsupported.** Without Docker you must install motion/ffmpeg/postgres yourself and export `TZ=UTC` for every process (node + motion + postgres) — otherwise clips, zips, and frame lists silently misalign. Then `npm run setup && npm start`.