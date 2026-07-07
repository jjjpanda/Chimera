# Lib <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Shared helpers every service imports (`require("lib")`, a `file:../lib` dep); loads `.env`. Not a server.

`index.js` exports all of these (CommonJS); `module.js` re-exports only `formatBytes` (ESM).

---
# Exports

**Middleware**
- `auth` — session/JWT-cookie guard + `requireAdmin` RBAC; scheduler bypass via `scheduler_AUTH` on `schedulableUrls`.
- `validateBody` — rejects empty bodies (`400`).
- `tracker` — admin webhook alert per request.
- `tempMiddleware` — `deprecation` / `construction` stubs.
- `helmetOptions` — CSP for `helmet`.

**Server & runtime**
- `handleServerStart` / `handleSecureServerStart` — start HTTP / HTTPS listeners (TLS paths from `certPaths`).
- `certPaths` — resolves TLS key/cert from `gateway_HOST` under `/etc/letsencrypt/live/`.
- `watchCertRenewal` — cert/key mtime poll periodically; `pm2.restart("gateway")` in the early AM UTC window after the certbot sidecar renews.
- `pruneInterval` — run a SQL prune on a 12h timer.
- `isPrimeInstance` — true on the single/prime pm2 instance.
- `subprocess` — pm2 helpers (`checkProcess`, `restart`, …).

**Cameras & alerts**
- `loadCameras` — motion + camera confs → `{id, name, rtsp_url, full_url}`, cached 10s.
- `webhookAlert` — POST to the alert webhook (`alert_URL` / `admin_alert_URL`).
- `alertTime` — `moment-timezone` helper in `alert_TZ`.

**Utilities**
- `formatBytes` — human-readable byte sizes.
- `randomID` — `nanoid` generator.
- `password` — shared password-policy JSON.
- `jsonFileHanding` — JSON read/write/validate (key spelled `jsonFileHanding`).

---
# Consumers & config

- Imported by every service: [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), [gateway](../gateway).
- Env: `SECRETKEY`, `scheduler_AUTH` (auth) · `alert_URL` / `admin_alert_URL` / `alert_TZ` (alerts) · `privateKey_FILEPATH` / `certificate_FILEPATH` / `gateway_HOST` (TLS) · `storage_MOTION_CONF_FILEPATH` (cameras). See [../env.example](../env.example).
