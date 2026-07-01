# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Runs cron-based tasks for the other servers: each tick fires an authenticated HTTP call to a whitelisted service route and records the outcome.

---
# Routes
## ▶ /task

All `/task` routes need a session (`authorize`); `/start`, `/stop`, `/destroy` also require `admin` (`requireAdmin`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/start|Schedule a task. `url` must be whitelisted, `body` a JSON string. A stopped `id` restarts it; already-running no-ops|`{ url: String, body: JSON-String, cronString: String }` for a new task, or `{ id: String }` to restart|`{ running: Boolean }`|
|GET|/list|List all scheduled tasks|None|`{ tasks: [TaskObj] }`|
|POST|/stop|Stop a task; protected tasks rejected|`{ id: String }`|`{ stopped: Boolean }`|
|POST|/destroy|Destroy a task; protected tasks rejected|`{ id: String }`|`{ destroyed: Boolean }`|
|GET|/runs|Run history across all tasks (latest 200, newest first)|None|`{ runs: [RunObj] }`|
|GET|/runs/:taskId|Run history for one task (latest 200, newest first)|`taskId` path param|`{ runs: [RunObj] }`|

```javascript
// id = task-[RandomAlphaNumeric]

//TaskObj
{
    id: String, // id
    url: String,
    body: Object,
    cronString: String,
    running: Boolean,
    protected: Boolean // true for the internal auto-cleanup task
}

//RunObj (a task_runs row)
{
    id: Number,
    task_id: String,
    url: String,
    status: String, // "success" | "failure"
    http_status: Number,
    error: String,
    ran_at: String // TIMESTAMPTZ
}
```

## ▶ /memory

Needs a session (`authorize`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Round-trips the [memory](../memory) socket to check coordination is responsive|None|`{}`|

## ▶ /schedule

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|

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
