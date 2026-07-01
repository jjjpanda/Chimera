# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The schedule server runs cron-based tasks on behalf of the other servers. On each tick it fires an authenticated HTTP call to a whitelisted service route and records the outcome.

---
# Routes
## ▶ /task

Every `/task` route sits behind the shared session guard (`authorize`); the mutating routes (`/start`, `/stop`, `/destroy`) additionally require the `admin` role (`requireAdmin`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/start|Schedules a task (admin). `url` must be a whitelisted target and `body` a JSON string. If an existing stopped `id` is supplied it is restarted; if it is already running the call no-ops|`{ url: String, body: JSON-String, cronString: String }` for a new task, or `{ id: String }` to restart an existing one|`{ running: Boolean }`|
|GET|/list|Lists all scheduled tasks|None|`{ tasks: [TaskObj] }`|
|POST|/stop|Stops a task (admin); protected tasks are rejected|`{ id: String }`|`{ stopped: Boolean }`|
|POST|/destroy|Destroys a task (admin); protected tasks are rejected|`{ id: String }`|`{ destroyed: Boolean }`|
|GET|/runs|Recent run history across all tasks (latest 200, newest first)|None|`{ runs: [RunObj] }`|
|GET|/runs/:taskId|Recent run history for one task (latest 200, newest first)|`taskId` path param|`{ runs: [RunObj] }`|

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

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Round-trips through the [memory](../memory) socket to confirm cross-instance coordination is responsive|None|`{}`|

## ▶ /schedule

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|

---
# How it fits

`server.js` starts this service under pm2 when `schedule_ON=true` (listening on `schedule_PORT`), and the [gateway](../gateway) reverse-proxies it when `schedule_PROXY_ON=true`. `/schedule/health` is mounted before the auth guard and is public; everything under `/task` and `/memory` requires a valid session via [lib](../lib)'s `auth.createAuthorize(pool)`.

**scheduler_AUTH.** When a cron fires, the service POSTs to `${gateway_HOST}${url}` with `scheduler_AUTH` in the `Authorization` header. [lib](../lib)'s auth middleware (`lib/utils/auth.js`) accepts that token in place of a user session, but only for a fixed allowlist of `schedulableUrls` — `/convert/createVideo`, `/convert/createZip`, `/file/pathMetrics`, `/file/pathDelete`, `/file/pathClean`, `/file/pathAutoClean`. `/task/start` refuses any `url` not on that list, so scheduled jobs can call [storage](../storage) endpoints without a login while nothing else is exposed.

**Coordination.** Task configs and their cron timers live in the [memory](../memory) socket (`memory/lib/scheduledTasks.js`) via `memory.client("TASK SCHEDULER")`, so a pm2 cluster shares one authoritative task registry. When a timer ticks, memory emits the task `id` and this service's handler performs the outbound HTTP call. `/memory/status` uses the same socket as a liveness probe.

**Persistence.** Every fire records a row in the `task_runs` Postgres table (`task_id`, `url`, `status`, `http_status`, `error`, `ran_at`; created by `chimera/prepareDatabase.js`) and emits a webhook alert (see `alert_URL` in [../env.example](../env.example)). On the primary pm2 instance, `startDbPruning()` runs every 12h and deletes `task_runs` rows older than 30 days.

**Auto-cleanup.** On the primary instance, when `storage_MAX_GB` is set, `autoRegisterCleanup()` registers a protected hourly task (`task-auto-cleanup` → `/file/pathAutoClean`) that trims oldest footage; being protected, it cannot be stopped or destroyed through the API.

Relevant env keys (see [../env.example](../env.example)): `schedule_ON`, `schedule_PORT`, `schedule_HOST`, `schedule_PROXY_ON`, `scheduler_AUTH`, `gateway_HOST`, `storage_MAX_GB`.
