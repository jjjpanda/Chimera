# Memory <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

[Socket.IO](https://socket.io) server sharing in-process state across a pm2 cluster (`chimeraInstances > 1`). Nothing persists here — though [schedule](../schedule) rebuilds its task timers from postgres on reconnect.

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
- **converterProcesses** — cancel handles for in-flight mp4/zip jobs ([storage](../storage)).
- **sessionSync** — broadcasts `sessionInvalidate`, `sessionInvalidateUser`, `sessionInvalidateAll` so every `AUTH` client's session cache stays in sync.

Built-in events: `log`, `callback` (schedule's `MEMORY-HEALTH` check), `disconnect`.

---
# Config

`memory_ON`, `memory_PORT`, `memory_HOST`, `memory_AUTH_TOKEN`; see [../env.example](../env.example).
