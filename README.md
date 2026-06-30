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

> **Bare-metal is unsupported.** Please use Docker. Running via pm2 on bare-metal is heavily discouraged and no longer documented.

### Admin account recovery

If no admin user remains (e.g. the admin account was deleted), an operator can create a new one:

1. Set the `setup_TOKEN` environment variable to a secret value and restart.
2. POST to `/setup` (or use the setup screen) with that token plus a username and password.

A new admin is created as long as no admin currently exists. The chosen username must not already be taken.