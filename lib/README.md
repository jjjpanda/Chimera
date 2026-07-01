# Lib <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Shared helpers every service imports as a `file:../lib` dependency; `require("lib")` returns the exports below and loads `.env` via `dotenv`. Not a server (no HTTP routes).

`index.js` (CommonJS) exports everything below; `module.js` (ESM) re-exports only `formatBytes`.

---
# Exports

## Auth & HTTP middleware

|Export|Description|
| :-|:- |
|`auth`|`createAuthorize(pool)` builds session-requiring middleware: verifies the `bearertoken` JWT cookie with `SECRETKEY`; with a `pool`, also checks the `auth`/`sessions` tables (role, revoked, force-password-change). `requireAdmin` gates admin-only routes. `schedulableUrls` is the allow-list the [schedule](../schedule) service may call by sending the `authorization` header equal to `scheduler_AUTH`.|
|`validateBody`|Rejects requests with an empty body (`400 {error, msg:"no body"}`).|
|`tracker`|Fires an admin `webhookAlert` per request (method, path, IP, user-agent); skips `/feed`, `/shared`, `/res`.|
|`tempMiddleware`|Stub responders `deprecation` and `construction` that reply with a stub error.|
|`helmetOptions`|CSP directives passed to `helmet` (allows `tfjs-models`, inline/eval scripts, blob media).|

## Server bootstrap

|Export|Description|
| :-|:- |
|`handleServerStart`|Starts an HTTP server via `app.listen(port, …)` with success/failure callbacks and a `SIGINT` close handler; returns the server.|
|`handleSecureServerStart`|Starts an HTTPS server, reading key/cert from `privateKey_FILEPATH`/`certificate_FILEPATH`; calls the failure callback if either file is unreadable.|

## Alerts & time

|Export|Description|
| :-|:- |
|`webhookAlert`|POSTs `content` to `alert_URL` (default) or `admin_alert_URL` (level `"admin"`); reports success/failure via an optional callback.|
|`alertTime`|`moment-timezone` helper: returns now, or parses a UTC input into the `alert_TZ` zone (default UTC).|

## Cameras & object detection

|Export|Description|
| :-|:- |
|`loadCameras`|Reads the motion conf at `storage_MOTION_CONF_FILEPATH`, resolves its `camera_dir` (relative to the conf unless absolute), parses each `*.conf` there, and returns cameras (`{id, name, rtsp_url, full_url}`) sorted by id; cached 10s. RTSP credentials are URL-encoded into `full_url`.|
|`objectState`|Per-instance singleton registry for the object-detection provider: `register`, `getConfig`, `getStatus`, `setConfig`, `scan` (each delegates to the registered provider, or a no-op default).|

## Formatting, IDs & rules

|Export|Description|
| :-|:- |
|`formatBytes`|Formats a byte count as a human-readable string (e.g. `1.5 GB`).|
|`randomID`|`generate(size=13)` returns a `nanoid` from an alphanumeric + `()` alphabet.|
|`password`|Password-policy JSON `{minLength: 8, requirement}`; shared rule for validation and UI messaging.|

## Files & processes

|Export|Description|
| :-|:- |
|`jsonFileHanding`|JSON helpers `readJSON`, `writeJSON`, `isStringJSON` (export key spelled `jsonFileHanding`).|
|`subprocess`|pm2 helpers: `processListMiddleware`, `checkProcess` (query pm2 for a named process), and `restart`.|

## Database & runtime

|Export|Description|
| :-|:- |
|`pruneInterval`|`(pool, sql)` runs `sql` on a 12-hour `setInterval` (unref'd) for periodic table pruning (e.g. `frame_deletes`, `task_runs`).|
|`isPrimeInstance`|Boolean; true on pm2 instance `0` or outside a cluster; gates work that must run on one instance only.|

---
# Consumers & config

- Imported by [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), [gateway](../gateway).
- Config from env; see [../env.example](../env.example): `SECRETKEY`, `scheduler_AUTH` (auth); `alert_URL`/`admin_alert_URL`/`alert_TZ` (alerts); `privateKey_FILEPATH`/`certificate_FILEPATH` (TLS); `storage_MOTION_CONF_FILEPATH` (cameras).
- `auth` reads command's `auth`/`sessions` Postgres tables; `pruneInterval` targets whichever table a service maintains.
