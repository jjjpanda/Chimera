# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Runs cron-based tasks for the other servers: each tick fires an authenticated HTTP call to a whitelisted service route and records the outcome.

---
# API

Session-guarded (`authorize`); starting, stopping, and destroying tasks additionally require admin (`requireAdmin`). `/schedule/health` is public.

The API schedules, lists, stops, and destroys cron tasks, and reads run history from `task_runs` (per task or across all, newest first). A new task's `url` must be whitelisted (see Behavior) and carry a JSON-string body; protected tasks — the internal auto-cleanup — can't be stopped or destroyed. A separate endpoint round-trips the [memory](../memory) socket to check cluster coordination is responsive.

---
# Behavior

- Runs under pm2 when `schedule_ON=true` (port `schedule_PORT`); gateway reverse-proxies when `schedule_PROXY_ON=true`.
- `/schedule/health` mounts before the session guard ([lib](../lib) `auth.createAuthorize(pool)`), so it's public.
- Crons POST to `${gateway_HOST}${url}` with `scheduler_AUTH` in the `Authorization` header. [lib](../lib) `auth.js` accepts this token instead of a session, but only for `schedulableUrls`: `/convert/createVideo`, `/convert/createZip`, `/file/pathMetrics`, `/file/pathDelete`, `/file/pathClean`, `/file/pathAutoClean`. `/task/start` rejects any other `url`.
- Task configs and cron timers live in the [memory](../memory) socket (`memory/lib/scheduledTasks.js`, `memory.client("TASK SCHEDULER")`), shared across the pm2 cluster; on tick, memory emits the task `id` and this service makes the HTTP call.
- Each fire writes a `task_runs` row (`task_id`, `url`, `status`, `http_status`, `error`, `ran_at`; created by `chimera/prepareDatabase.js`) and emits a webhook alert (`alert_URL`). On the primary instance, `startDbPruning()` runs every 12h, deleting `task_runs` rows older than 30 days.
- On the primary instance, if `storage_MAX_GB` is set, `autoRegisterCleanup()` adds a protected hourly task (`task-auto-cleanup` → `/file/pathAutoClean`) trimming oldest footage; protected tasks can't be stopped or destroyed via the API.

---
# Config

- `schedule_ON`, `schedule_PORT`, `schedule_HOST`, `schedule_PROXY_ON`, `scheduler_AUTH`, `gateway_HOST`, `storage_MAX_GB`; see [../env.example](../env.example).
