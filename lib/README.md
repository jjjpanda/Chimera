# Lib <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Shared helpers every service imports (`require("lib")`, a `file:../lib` dep); loads `.env`. Not a server.

Exports below are from `index.js` (CommonJS) unless noted; `module.js` re-exports only `formatBytes` (ESM).

---
# Exports

**Middleware**
- `auth` — session/JWT-cookie guard + `requireAdmin` RBAC; scheduler bypass via `scheduler_AUTH` on `schedulableUrls`.
- `validateBody` — rejects empty bodies (`400`).
- `tracker` — admin webhook alert per request.
- `tempMiddleware` — `deprecation` / `construction` stubs.
- `helmetOptions` — CSP for `helmet`.

**Server & runtime**
- `handleServerStart` / `handleSecureServerStart` — start HTTP / HTTPS listeners (TLS paths from `certPaths`, an internal helper not exported from `index.js`).
- `watchCertRenewal` — cert/key mtime poll periodically; `pm2.restart("gateway")` in the early AM UTC window after the certbot sidecar renews.
- `pruneInterval` — run a SQL prune on a 12h timer.
- `createPool` — `pg.Pool` factory with a labeled `error` logger; bounds connect (`5s`), query (`statement_timeout` 30s, client-side `query_timeout` 31s so postgres aborts first) and `idle_in_transaction_session_timeout` (30s, so a wedged process cannot sit on row locks), and keeps sockets alive. Takes an optional overrides object for long-running workloads — but **do not raise `connectionTimeoutMillis` to match a long query budget.** pg reuses that one knob for two unrelated things: waiting for a free client once the pool hits `max`, *and* establishing a brand-new connection (`pg-pool` `newClient()`). Raise it and a postgres that accepts TCP but never completes startup will hang every caller on this pool for the full budget — the unbounded hang #301 set out to kill. Keep it in the seconds-to-tens-of-seconds range regardless of how long the queries are allowed to run.
- `withTransaction` — run `fn(client)` in a `BEGIN`/`COMMIT` on a pooled client; rolls back (bounded) and discards the client if the rollback itself fails. It also swallows the client's `error` events for the duration of the checkout, and **that is the reason to reach for it over a bare `pool.connect()`**: `pg-pool` strips its own `error` listener while a client is checked out (`_acquireClient`) and only restores it on release, so a socket death mid-transaction reaches the process as an unhandled `error` event and takes the service down. Anything that holds a client should go through this helper.
- `isPrimeInstance` — true on the single/prime pm2 instance.
- `subprocess` — pm2 helpers (`checkProcess`, `restart`, …).
- `schedulableUrls` — routes `scheduler_AUTH` may call without a session.

**Cameras & alerts**
- `loadCameras` — motion + camera confs → `{id, name, rtsp_url, full_url}` (re-read on every call; rejects on I/O failure so callers can tell "unreadable" from "no cameras"; `loadCamerasSync` (sync, still returns `[]`) lives in `utils/loadCameras.js` but isn't exported from `index.js`).
- `cameraConfFiles` — conf paths declaring a given `camera_id` (rejects on I/O failure, same contract as `loadCameras`).
- `cameraConfDir` — resolves the `camera_dir` referenced by `storage_MOTION_CONF_FILEPATH`.
- `webhookAlert` — POST to the alert webhook (`alert_URL` / `admin_alert_URL`).
- `alertTime` — `moment-timezone` helper in `alert_TZ`.

**Utilities**
- `formatBytes` — human-readable byte sizes.
- `randomID` — `nanoid` generator.
- `password` — shared password-policy JSON.
- `jsonFileHanding` — JSON read/write/validate (key spelled `jsonFileHanding`).
- `mapLimit` — run an async fn over items with bounded concurrency.

---
# Consumers & config

- Imported by every service: [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), [gateway](../gateway).
- Env: `SECRETKEY`, `scheduler_AUTH` (auth) · `alert_URL` / `admin_alert_URL` / `alert_TZ` (alerts) · `privateKey_FILEPATH` / `certificate_FILEPATH` / `gateway_HOST` (TLS) · `storage_MOTION_CONF_FILEPATH` (cameras). See [../env.example](../env.example).
