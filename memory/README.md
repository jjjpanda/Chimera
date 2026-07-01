# Memory <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

[Socket.IO](https://socket.io) server that shares in-process state across a pm2 cluster (`chimeraInstances > 1`); nothing persists, so all state is lost on restart.

---
# Runtime

- Boot: `server.js` calls `require("memory").server()`. Listens only when `memory_ON == "true"` and the process is the prime pm2 instance (`isPrimeInstance` from [lib](../lib); `NODE_APP_INSTANCE` is `0` or unset), so exactly one instance runs it.
- `pm2.config.js` forces `memory_ON=true` when `chimeraInstances > 1` or `"max"`.
- Internal only: not exposed through the [gateway](../gateway), no `_PROXY_ON` toggle. Handshake requires `Authorization` header `== memory_AUTH_TOKEN`, else rejected.
- Clients connect via `require("memory").client("<LABEL>")`, dialing `memory_HOST` with the auth header. Label is connection-logging only; all clients share the default namespace. Labels: `AUTH` ([command](../command)), `OBJECT` ([object](../object)), `TASK SCHEDULER` + `MEMORY-HEALTH` ([schedule](../schedule)), `PROCESS`/`VIDEO PROCESS`/`ZIP PROCESS` ([storage](../storage)).
- No Postgres tables.

---
# Modules

Each module is a factory in [lib/](lib) that [socket.js](socket.js) wires to socket events on `connection`.

|Module|Events|Description|Emitted by|
| :-|:- |:-|:- |
|[loginAttempts](lib/loginAttempts.js)|`loginReserve`, `loginRelease`|Shared login rate limiter over a fixed (tumbling) window. `loginReserve(key, max, windowMs, cb)` reserves a slot in the current window; `cb(blocked)` reports blocked without reserving when the key is at `max`. Counter resets wholesale when the window expires. `loginRelease(key)` refunds a slot (e.g. on successful login). In-memory `Map`, size-bounded pruning. When `memory_ON` is off, [command](../command) falls back to a local per-instance copy.|[command](../command) (`AUTH`)|
|[scheduledTasks](lib/scheduledTasks.js)|`createTask`, `startTask`, `stopTask`, `destroyTask`, `listTask`|Registry of `node-cron` jobs keyed by task id. On fire, `io.emit(task.id)` broadcasts a tick to every instance; task configs are returned to callers.|[schedule](../schedule) (`TASK SCHEDULER`)|
|[converterProcesses](lib/converterProcesses.js)|`saveProcessEnder`, `cancelProcess`|Registry of cancel functions for in-flight mp4/zip conversions, so any instance can cancel a job started on another. `saveProcessEnder(id, fn)` stores the ender; `cancelProcess(id, type)` invokes and removes it.|[storage](../storage) (`VIDEO PROCESS`, `ZIP PROCESS`, `PROCESS`)|
|[objectState](lib/objectState.js)|`objectGetState`, `objectSetConfig`, `objectScan`|Object-detection state via [lib](../lib)'s `objectState`. `objectGetState` returns `{config, status}`; `objectSetConfig(updates)` writes config; `objectScan(camera)` runs a scan, returns `{detections}` or `{error}`.|[object](../object) (`OBJECT`)|
|[cronTask](lib/cronTask.js)|`cron`|Registers one `node-cron` job that emits a caller-supplied id on schedule (`io.emit(cronTaskID)`).|—|

Built-in events: `log` (logs a payload server-side), `callback` (invokes the ack; used by [schedule](../schedule)'s health check as `MEMORY-HEALTH`), `disconnect`.

---
# Config

`memory_ON`, `memory_PORT`, `memory_HOST`, `memory_AUTH_TOKEN`; see [../env.example](../env.example).
