# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Cron tasks for the other services: each tick fires an authenticated HTTP call to a whitelisted route and records the outcome.

---
# API

Session-guarded (`authorize`) except `/schedule/health`; every task route also requires admin (`requireAdmin`) — only the memory-socket health-check doesn't:

- schedule, list, stop, destroy cron tasks
- read run history from `task_runs` (per task or all, newest first)
- health-check the [memory](../memory) socket round-trip

New tasks need a whitelisted `url` and a JSON-string body. Protected tasks (the auto-cleanup) can't be stopped or destroyed.

---
# Runtime

- Runs under pm2 when `schedule_ON=true`; [gateway](../gateway) proxies when `schedule_PROXY_ON=true`.
- Crons POST directly to `${storage_HOST}${url}` (bypassing the gateway) with `scheduler_AUTH` in `Authorization`. [lib](../lib) accepts this token (instead of a session) only for `schedulableUrls`: `/convert/createVideo`, `/convert/createZip`, `/file/pathMetrics`, `/file/pathDelete`, `/file/pathClean`, `/file/pathAutoClean` — and only from a source matching `scheduler_TRUSTED_SOURCES` (default `loopback`).
- `storage_HOST` must reach storage directly, with an explicit `http://` or `https://`. Pointing it at [gateway](../gateway) 401s every task whatever `scheduler_TRUSTED_SOURCES` says, because the gateway strips `Authorization`.
- Any reverse proxy in front of storage **must** strip `Authorization` from public traffic. This applies at the default `loopback` setting, not just to widened ranges: a proxy that forwards `Authorization` while dialing storage over loopback is already inside the trusted range, and re-exposes `scheduler_AUTH` to the internet.
- Task configs and timers live in the [memory](../memory) socket, shared across the cluster; on tick memory emits the task id and this service makes the call.
- Each fire writes a `task_runs` row and a webhook alert. The prime instance prunes rows older than 30 days.
- If `storage_MAX_GB` is set, the prime instance registers a protected hourly `/file/pathAutoClean` task trimming oldest footage.

---
# Config

`schedule_ON`, `schedule_PORT`, `schedule_HOST`, `schedule_PROXY_ON`, `scheduler_AUTH`, `scheduler_TRUSTED_SOURCES`, `storage_HOST`, `storage_MAX_GB`; see [../env.example](../env.example).
