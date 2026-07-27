# Chimera

<img src="command/frontend/res/logo.png" alt="logo" width="90"/>

Microservices security-camera system for RTSP/IP cameras.

```mermaid
flowchart LR
    user(("Browser"))
    cam["📷 IP Cameras · RTSP"]

    gw["gateway<br/>TLS · public entry"]

    subgraph cap [Capture]
      motion["motion → frames"]
      ff["ffmpeg ×N → HLS"]
    end

    subgraph svcs [Services]
      cmd["command<br/>web app · auth"]
      store["storage<br/>frames · clips"]
      live["livestream<br/>HLS"]
      obj["object<br/>detection"]
      sched["schedule<br/>cron"]
    end

    db[("Postgres")]

    user -->|HTTPS| gw
    cam --> motion & ff
    motion --> store
    ff --> live & obj
    gw --> cmd & store & live & obj & sched
    store & cmd & obj & sched --> db
```

## Services

| | |
|---|---|
| [command](command) | Web app · auth · RBAC · sessions |
| [storage](storage) | Saves motion frames · builds clips & zips · quota |
| [livestream](livestream) | Per-camera HLS streams |
| [object](object) | YOLOX detection on feeds · webhook alerts |
| [schedule](schedule) | Cron jobs (auto-cleanup, etc.) |
| [gateway](gateway) | Public entrypoint · reverse proxy · TLS |
| [memory](memory) | Shared state across a pm2 cluster |

Each service is toggled by `<prefix>_ON`. The gateway is the only public port.

**Shared:** [lib](lib) (helpers every service imports) · [chimera](chimera) (boot scripts)<br>
**Bundled in the image:** motion · ffmpeg · heartbeat · postgres

## Quick start

> **Docker only.** The image bundles motion, ffmpeg, Node and pm2, and pins `TZ=UTC`. Postgres runs as a side container.

**What you need on your machine:**

- **Docker**, with Compose **v2.23.1 or newer**. Check with `docker compose version` — older ones cannot read `secrets.environment`.
- **Node 22+ and npm 7+**. Every `npm run` script below runs on your machine — the config check and the `docker:*` wrappers. The services themselves all run in the container.
- **`git` and a connection to github.com**. `npm install` pulls every service's packages onto your machine, because the check imports their code, and one package comes straight from GitHub.

### 1 · Install

```bash
npm install
```

### 2 · Write the config

You fill in three things: `.env`, `motion.conf`, and one file per camera in `cameraconf/`.

**Guided** — asks you for every value, then writes all three:

```bash
npm run preflight
```

**By hand** — same three files, you edit them yourself. In the copied `.env` every right-hand side is a description of the value, not a value:

```bash
cp env.example .env
cp motion.conf.example motion.conf
cp cameraconf/camera.conf.example cameraconf/cam1.conf   # one per camera
```

A camera's file holds its address, username and password. Every `.env` value is explained beside it in [env.example](env.example), and a `# Docker:` note marks the ones the container fixes for you.

Every service shares one container, so each `<prefix>_HOST` is just loopback plus that service's own port — the `http://127.0.0.1:8081` half of the example, not the domain half. `gateway_HOST` is the exception: it is the address you type in a browser.

### 3 · Build and start

```bash
npm run docker:build
npm run docker:up
```

The build re-reads `.env` first and refuses to run on a value that is missing, the wrong type, or the wrong shape. The error names the value; [env.example](env.example) says what it wants.

### 4 · Open it

Go to your `gateway_HOST` in a browser, adding `gateway_PORT` if the address does not already carry one — `http://192.168.1.50:8080`.

No users exist yet, so you land on a setup screen. It wants a username, a password, and the `setup_TOKEN` from your `.env`. That gets you the first admin account.

**Your footage** lives in a Docker volume, not in a folder you can browse. Pick a camera and a time range in the web app, and it builds an MP4 or a zip you download from the same page.

**Adding a camera** is a new `.conf` in `cameraconf/` plus `npm run docker:restart`. Chimera reads every file in that folder at startup, so there is no second list to keep in step.

<details>
<summary><b>HTTP or HTTPS?</b> — the login cookie has to agree with it</summary>

Set `command_COOKIE_SECURE=true` if browsers reach you over HTTPS, however the certificate gets there. Set it `false` for plain HTTP. Browsers drop a `Secure` cookie on a plain-HTTP origin, so the wrong answer breaks login and nothing else.

On plain HTTP, also give `gateway_HOST` an explicit `http://` prefix — `http://192.168.1.50:8080` — and leave `gateway_HTTPS_Redirect` and `certbot_ON` at `false`. An HTTPS port still gets published either way — `gateway_PORT_SECURE`, or 443 when you leave it blank — so name a free port if something else already holds 443.

Preflight catches only one of the two mistakes: `command_COOKIE_SECURE=false` while something says HTTPS. It then lists the three things that could have said so — an `https://` or prefix-less `gateway_HOST`, `gateway_HTTPS_Redirect=true`, `certbot_ON=true` — without saying which one did. The opposite mistake, `true` on a plain-HTTP deploy, passes the check and still breaks login. Nothing is checked at all when `command_ON=false`, or when `gateway_HOST` is blank or points at this machine (`localhost`, `127.0.0.1`, `::1`).

Why the cookie can't just read the request: [command](command#config).

</details>

<details>
<summary><b>It built fine but the container keeps restarting</b></summary>

A few checks wait until the container starts: the `*_URL` addresses and the file paths. The cookie check runs again there too, in case `.env` changed after the build. So a build can pass and still fail on startup — the container then restarts over and over, and `npm run docker:logs` shows which value it stopped on.

**Or it says `CANNOT READ`.** The app reads `.env` and `motion.conf` from inside the container as a normal user, not root. Copy them with plain `cp`, which leaves them readable — no `sudo`, and no `chmod 600`. If you already used `sudo`, `sudo chmod 644 .env motion.conf` undoes it.

This only matters when the project folder lives on Linux — a Linux host, or a folder inside WSL such as `\\wsl$\Ubuntu\home\you\chimera`. On a Mac or Windows drive, such as `C:\Users\you\chimera` or `/mnt/c/Users/you/chimera`, Docker Desktop sets the ownership for you.

</details>

<details>
<summary><b>Why signing in leaves a second cookie</b></summary>

Your first successful login leaves a second cookie in that browser for a year. It only marks the device as one you have used before, so someone guessing your password elsewhere cannot lock you out of it. What it does, and how to void it if the device is lost: [login limits](command#login-limits).

</details>

## Reference

<details>
<summary><b>Commands</b></summary>

`npm run` lists every script; the `docker:*` ones wrap `docker compose` ([package.json](package.json)).

</details>

<details>
<summary><b>Boot & scaling</b></summary>

- **Boot chain** ([entrypoint.sh](entrypoint.sh), aborts on first failure): ACME dir → `validateEnvVars.js` → `prepareDatabase.js` → `pm2-runtime`.
- One pm2 process per enabled service ([pm2.config.js](pm2.config.js)); crashes restart per-process, no cross-service chaining.
- `object` and `memory` are single-instance; the rest honor `chimeraInstances`.
- A cluster (`chimeraInstances` != `1`) needs both `chimera_MEM_LIMIT` and `chimera_PIDS_LIMIT` raised in `.env`, or it's OOM-killed at boot with no explanatory message. Budget pids well past the process count — the cgroup counts threads, and motion's `on_picture_save` forks five processes per saved frame.
- In production pm2 writes no log files; everything streams to container stdout, rotated by the `json-file` driver (`npm run docker:logs`).
- `chimera` has no `DAC_OVERRIDE`, so `docker compose exec chimera pm2 list` fails as root — use `docker compose exec -u node chimera pm2 list`.

</details>

<details>
<summary><b>TLS renewal</b></summary>

`certbot_ON=true` auto-issues + renews Let's Encrypt certs over HTTP-01, which needs `gateway_PORT=80`; the gateway self-restarts nightly to load them. Disable for BYO certs / upstream TLS.

certbot runs in its own container. Start the stack with `npm run docker:up` rather than a bare `docker compose up` — the script drops that container when `certbot_ON=false` ([chimera/compose.js](chimera/compose.js)), where compose alone would leave it sitting idle.

</details>

<details>
<summary><b>Database schema</b></summary>

[prepareDatabase.js](chimera/prepareDatabase.js) creates the tables and indexes if they are missing, and checks an existing table's column names (not types) against the expected v6 shape rather than assuming it is right. Table and index list: [chimera](chimera#preparedatabasejs). Connection settings: [env.example](env.example).

</details>
