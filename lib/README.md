# Lib <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Shared helpers every service imports (`require("lib")`, a `file:../lib` dep); loads `.env`. Not a server.

Exports below are from `index.js` (CommonJS) unless noted; `module.js` re-exports only `formatBytes` (ESM).

---
# Exports

**Middleware**
- `auth` — session/JWT-cookie guard + `requireAdmin` RBAC. The scheduler bypasses it with `scheduler_AUTH`, on a path in `schedulableUrls`, from a peer matching `scheduler_TRUSTED_SOURCES` (proxy-addr list, defaults to `loopback`).
- `validateBody` — rejects empty bodies (`400`).
- `tracker` — admin webhook alert in two tiers. **High-impact:** `/authorization/(login|setup|password|users|sessions)`, `/camera/<id>`, `/convert/(createVideo|createZip|cancelProcess|deleteProcess)`, `/file/(pathDelete|pathClean|pathAutoClean)`, `/livestream/restart`, `/object/(config|scan)`, `/task/(start|stop|destroy)`; `GET` on the users/sessions list endpoints and `/object/config` is excluded. **Probe:** any path no service mounts, less the files browsers and crawlers fetch unprompted (`favicon.ico`, `robots.txt`, `sitemap.xml`, `apple-touch-icon.png`, with an optional `-<w>x<h>` size and an optional `-precomposed`). Every other path is silent. Each tier holds its own budget of 30 alerts globally and 10 per IP each minute, so a probe flood cannot silence high-impact alerts.
- `tempMiddleware` — `deprecation` / `construction` stubs.
- `helmetOptions` — CSP for `helmet`.
- `rateLimiter(namespace)` — reservation-based rate limiter factory; returns `{ rateLimit, makeReserve, releaseOnSuccess, client }`. Shares failures across pm2 instances via `memory.client(namespace)` when `memory_ON=true`, falling back to a local store when disconnected or when a shared reservation's ack errors or times out (1s). `rateLimit(opts)` wires the 429 response, and refunds the reservation on a non-4xx finish only when `opts.releaseOnSuccess` is set — callers that must count every accepted call omit it.

**Server & runtime**
- `handleServerStart` / `handleSecureServerStart` — start HTTP / HTTPS listeners (TLS paths from `certPaths`, an internal helper not exported from `index.js`).
- `watchCertRenewal` — cert/key mtime poll periodically; `pm2.restart("gateway")` in the early AM UTC window after the certbot sidecar renews.
- `pruneInterval` — run a SQL prune on a 12h timer.
- `createPool` — `pg.Pool` factory with a labeled `error` logger; bounds connect/query/idle timeouts and keeps sockets alive. Takes optional overrides for long-running workloads — but **do not raise `connectionTimeoutMillis` to match a long query budget**: pg reuses that knob both to wait for a free client and to open new connections, so raising it can hang every caller when postgres accepts TCP but never completes startup.
- `withTransaction` — runs `fn(client)` in a `BEGIN`/`COMMIT`/`ROLLBACK` on a pooled client, discarding the client if rollback itself fails. Also swallows the client's `error` events while checked out — `pg-pool` drops its own listener then, so a socket death mid-transaction would otherwise crash the process. Prefer this over a bare `pool.connect()` for anything holding a client.
- `isPrimeInstance` — true on the single/prime pm2 instance.
- `subprocess` — pm2 helpers (`checkProcess`, `restart`, …).
- `schedulableUrls` — routes `scheduler_AUTH` may call without a session.

**Cameras & alerts**
- `loadCameras` — motion + camera confs → `{id, name, rtsp_url, full_url}`; re-read on every call, and rejects on I/O failure so callers can tell "unreadable" from "no cameras". `loadCamerasSync` (returns `[]` instead) lives in `utils/loadCameras.js`, unexported.
- `cameraConfFiles` — conf paths declaring a given `camera_id` (rejects on I/O failure, same contract as `loadCameras`).
- `cameraConfDir` — resolves the `camera_dir` referenced by `storage_MOTION_CONF_FILEPATH`.
- `webhookAlert` — POST to the alert webhook (`alert_URL` / `admin_alert_URL`).
- `alertTime` — `moment-timezone` helper in `alert_TZ`.

**Utilities**
- `formatBytes` — human-readable byte sizes.
- `randomID` — `nanoid` generator.
- `password` — shared password-policy JSON.
- `frames` — shared video-export frame-count limits JSON (`min` / `max` / `default`).
- `jsonFileHanding` — JSON read/write/validate (key spelled `jsonFileHanding`).
- `mapLimit` — run an async fn over items with bounded concurrency.

---
# Consumers & config

- Imported by every service: [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), [gateway](../gateway).
- Env: `SECRETKEY`, `scheduler_AUTH`, `scheduler_TRUSTED_SOURCES` (auth) · `alert_URL` / `admin_alert_URL` / `alert_TZ` (alerts) · `privateKey_FILEPATH` / `certificate_FILEPATH` / `gateway_HOST` (TLS) · `storage_MOTION_CONF_FILEPATH` (cameras). See [../env.example](../env.example).
