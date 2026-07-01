# Lib <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The lib is the library 📖 of shared tools that every service uses. It is not a server — it exposes no HTTP routes. Each service pulls it in as a local `file:../lib` dependency and `require("lib")` returns the exports below. Importing it loads `.env` via `dotenv`, so config is available to all consumers.

The CommonJS entry (`index.js`) exports everything listed here. The `module` entry (`module.js`) is an ESM shim that re-exports only `formatBytes`.

---
# Exports

## ▶ Auth & HTTP middleware

|Export|Description|
| :-|:- |
|`auth`|`createAuthorize(pool)` builds middleware that requires a valid session — it verifies the `bearertoken` JWT cookie with `SECRETKEY` and, when a `pool` is passed, checks the `auth`/`sessions` tables (role, revoked, force-password-change). `requireAdmin` gates admin-only routes. `schedulableUrls` is the allow-list the [schedule](../schedule) service may call by sending the standard `authorization` header equal to the `scheduler_AUTH` env var.|
|`validateBody`|Middleware that rejects requests with an empty body (`400 {error, msg:"no body"}`).|
|`tracker`|Middleware that fires an admin `webhookAlert` per request (method, path, IP, user-agent), skipping `/feed`, `/shared`, `/res`.|
|`tempMiddleware`|Placeholder responders `deprecation` and `construction` that reply with a stub error message.|
|`helmetOptions`|Content-Security-Policy directives passed to `helmet` (allows `tfjs-models`, inline/eval scripts, blob media).|

## ▶ Server bootstrap

|Export|Description|
| :-|:- |
|`handleServerStart`|Starts an HTTP server via `app.listen(port, …)` with success/failure callbacks and a `SIGINT` close handler; returns the server.|
|`handleSecureServerStart`|Starts an HTTPS server, reading the key/cert from `privateKey_FILEPATH` / `certificate_FILEPATH`; calls the failure callback if either file is unreadable.|

## ▶ Alerts & time

|Export|Description|
| :-|:- |
|`webhookAlert`|POSTs `content` to `alert_URL` (default) or `admin_alert_URL` (level `"admin"`); reports success/failure through an optional callback.|
|`alertTime`|`moment-timezone` helper — returns now, or parses a UTC input and converts it into the `alert_TZ` zone (defaults to UTC).|

## ▶ Cameras & object detection

|Export|Description|
| :-|:- |
|`loadCameras`|Reads the motion conf at `storage_MOTION_CONF_FILEPATH`, resolves its `camera_dir` (relative to the conf's own location unless absolute), parses each `*.conf` in that directory, and returns the camera list (`{id, name, rtsp_url, full_url}`) sorted by id; results are cached for 10s. RTSP credentials are URL-encoded into `full_url`.|
|`objectState`|In-process (per-instance) singleton registry for the object-detection provider: `register`, `getConfig`, `getStatus`, `setConfig`, `scan` (each delegates to the registered provider, or a no-op default).|

## ▶ Formatting, IDs & rules

|Export|Description|
| :-|:- |
|`formatBytes`|Formats a byte count as a human-readable string (e.g. `1.5 GB`).|
|`randomID`|`generate(size=13)` returns a `nanoid` from an alphanumeric + `()` alphabet.|
|`password`|Password-policy JSON: `{minLength: 8, requirement}` — the shared rule for password validation and UI messaging.|

## ▶ Files & processes

|Export|Description|
| :-|:- |
|`jsonFileHanding`|JSON file helpers `readJSON`, `writeJSON`, `isStringJSON` (note: the export key is spelled `jsonFileHanding`).|
|`subprocess`|pm2 helpers: `processListMiddleware` and `checkProcess` (query pm2 for a named process) and `restart` (restart it).|

## ▶ Database & runtime

|Export|Description|
| :-|:- |
|`pruneInterval`|`(pool, sql)` runs the given SQL on a 12-hour `setInterval` (unref'd) — used for periodic table pruning (e.g. `frame_deletes`, `task_runs`).|
|`isPrimeInstance`|Boolean, true when running as pm2 instance `0` or outside a cluster; used to gate work that must run on only one instance.|

---
# How it fits

- Consumed by [command](../command), [storage](../storage), [livestream](../livestream), [schedule](../schedule), [object](../object), [memory](../memory), and [gateway](../gateway) as a `file:../lib` dependency.
- Reads config from the environment; see [../env.example](../env.example) for the keys these helpers use — `SECRETKEY` and `scheduler_AUTH` (auth), `alert_URL` / `admin_alert_URL` / `alert_TZ` (alerts), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS bootstrap), and `storage_MOTION_CONF_FILEPATH` (cameras).
- The `auth` middleware reads the command service's `auth` and `sessions` Postgres tables; `pruneInterval` is pointed at whichever table a service maintains.
