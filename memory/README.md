# Memory <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

[Socket.IO](https://socket.io) server sharing in-process state across a pm2 cluster (`chimeraInstances` = `max`, `0`, `-1`, or any integer > 1). Nothing persists.

---
# Runtime

- Runs only on the prime pm2 instance, only when `memory_ON=true` (`pm2.config.js` forces this in cluster mode). Launched by pm2 (`memory/start.js`, single instance).
- Internal only, no gateway route. Clients (`require("memory").client("<LABEL>")`) must send `Authorization: memory_AUTH_TOKEN`.
- Labels (logging only): `AUTH` (command, livestream, object, schedule, storage), `TASK SCHEDULER` + `MEMORY-HEALTH` (schedule), `PROCESS` / `VIDEO PROCESS` / `ZIP PROCESS` (storage).

---
# Modules

Factories in [lib/](lib), wired to socket events by [socket.js](socket.js):

- **loginAttempts** — shared login rate limiter (tumbling window); command falls back to a local copy when `memory_ON` is off.
- **scheduledTasks** — `node-cron` registry; on fire, emits the task id to every instance ([schedule](../schedule)).
- **converterProcesses** — cancel handles for in-flight mp4/zip jobs ([storage](../storage)). The handle is the ack of storage's `saveProcessEnder` emit, so socket.io-client holds it in `socket.acks` until this server answers it. `cancelProcess` answers `true` (cancel); `deleteProcessEnder` answers `false` (job already over) — it must answer, or storage keeps the closure, and the ffmpeg or archiver object it captures, for the life of the process. `disconnect` drops the client's handles without answering, since the client clears its own acks on close. Storage gates both emits on `memory_ON`, not on the client's connection state: with memory off no server ever answers, so the ack stays in `socket.acks` for the life of the process. While memory is on but the socket is still connecting or reconnecting, socket.io-client buffers the emit and flushes it on connect, so a job started in that window still registers an ender and stays cancellable.
- **sessionSync** — broadcasts `sessionInvalidate`, `sessionInvalidateUser`, `sessionInvalidateAll` so every `AUTH` client's session cache stays in sync. Immediate cross-process/cross-service revocation requires `memory_ON=true`; with it off, `invalidateSession`/`invalidateUser` only clear the calling process's cache, and other workers and services keep serving a revoked session from their own cache for up to `SESSION_CACHE_MS` (5s, [../lib/utils/auth.js](../lib/utils/auth.js)) until TTL expiry (bounded, fails closed).

Built-in events: `log`, `callback` (schedule's `MEMORY-HEALTH` check), `disconnect`.

---
# Config

`memory_ON`, `memory_PORT`, `memory_HOST`, `memory_AUTH_TOKEN`; see [../env.example](../env.example).
