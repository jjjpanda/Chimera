# Memory <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The memory server is a [Socket.IO](https://socket.io) server that brokers shared, cross-instance state so a pm2 cluster (`chimeraInstances > 1`) stays coordinated. It holds volatile in-process state only — nothing is persisted, so all state is lost on restart.

---
# How it fits

- The root [server.js](../server.js) calls `require("memory").server()` in the boot chain, but the socket only actually listens when `memory_ON == "true"` **and** the process is the prime pm2 instance (`isPrimeInstance` from [lib](../lib) — `NODE_APP_INSTANCE` is `0` or unset). So exactly one instance runs the broker.
- `memory_ON` is forced to `true` by [pm2.config.js](../pm2.config.js) whenever `chimeraInstances > 1` or `"max"`, because a cluster must share state.
- It is an internal service: it is **not** exposed through the [gateway](../gateway) and has no `_PROXY_ON` toggle. Connections are authenticated by the `Authorization` request header, which must equal `memory_AUTH_TOKEN`; anything else is rejected at handshake.
- Other services connect as clients with `require("memory").client("<LABEL>")`, which dials `memory_HOST` with the auth header attached. The label is only used in connection logging — every client shares the default namespace. Labels currently in use: `AUTH` ([command](../command)), `OBJECT` ([object](../object)), `TASK SCHEDULER` and `MEMORY-HEALTH` ([schedule](../schedule)), and `PROCESS` / `VIDEO PROCESS` / `ZIP PROCESS` ([storage](../storage)).
- Uses no Postgres tables. Env keys: `memory_ON`, `memory_PORT`, `memory_HOST`, `memory_AUTH_TOKEN` (see [../env.example](../env.example)).

---
# Modules

Each module is a factory in [lib/](lib) that [socket.js](socket.js) wires to socket events on `connection`.

|Module|Events|Description|Emitted by|
| :-|:- |:-|:- |
|[loginAttempts](lib/loginAttempts.js)|`loginReserve`, `loginRelease`|Shared login rate limiter over a fixed (tumbling) window. `loginReserve(key, max, windowMs, cb)` reserves a slot within the current window and calls back with a `blocked` boolean (when the key is already at `max` it reports blocked without reserving); once the window expires the counter resets wholesale. `loginRelease(key)` refunds a slot (e.g. on a successful login). Counters live in an in-memory `Map` with size-bounded pruning. When `memory_ON` is off, [command](../command) falls back to a local, per-instance copy of the same module.|[command](../command) (`AUTH`)|
|[scheduledTasks](lib/scheduledTasks.js)|`createTask`, `startTask`, `stopTask`, `destroyTask`, `listTask`|Registry of `node-cron` jobs keyed by task id. When a job fires it does `io.emit(task.id)`, broadcasting a tick to every connected instance; task configs are returned to callers.|[schedule](../schedule) (`TASK SCHEDULER`)|
|[converterProcesses](lib/converterProcesses.js)|`saveProcessEnder`, `cancelProcess`|Registry of cancel functions for in-flight mp4/zip conversions, so any instance can cancel a job started on another. `saveProcessEnder(id, fn)` stores the ender; `cancelProcess(id, type)` invokes and removes it.|[storage](../storage) (`VIDEO PROCESS`, `ZIP PROCESS`, `PROCESS`)|
|[objectState](lib/objectState.js)|`objectGetState`, `objectSetConfig`, `objectScan`|Brokers object-detection state via [lib](../lib)'s `objectState`: `objectGetState` returns `{config, status}`, `objectSetConfig(updates)` writes config, `objectScan(camera)` runs a scan and returns `{detections}` (or `{error}`).|[object](../object) (`OBJECT`)|
|[cronTask](lib/cronTask.js)|`cron`|Registers a single `node-cron` job that emits a caller-supplied id on schedule (`io.emit(cronTaskID)`).|No confirmed emitter (see grounding notes)|

Built-in events also handled: `log` (logs a payload server-side), `callback` (invokes the ack — used by [schedule](../schedule)'s health check as `MEMORY-HEALTH`), and `disconnect`.
