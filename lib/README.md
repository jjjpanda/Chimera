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
- `createPool` — `pg.Pool` factory with a labeled `error` logger.
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
- `timingSafeCompare` — constant-time string comparison.
- `randomID` — `nanoid` generator.
- `password` — shared password-policy JSON.
- `jsonFileHanding` — JSON read/write/validate (key spelled `jsonFileHanding`).
- `mapLimit` — run an async fn over items with bounded concurrency.
- `multiInstance` — true when `chimeraInstances` requests more than one pm2 instance (`"max"`, `0`, `-1`, `>1`).

---
# Consumers & config

- Imported by every service: [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), [gateway](../gateway).
- Env: `SECRETKEY`, `scheduler_AUTH` (auth) · `alert_URL` / `admin_alert_URL` / `alert_TZ` (alerts) · `privateKey_FILEPATH` / `certificate_FILEPATH` / `gateway_HOST` (TLS) · `storage_MOTION_CONF_FILEPATH` (cameras). See [../env.example](../env.example).
