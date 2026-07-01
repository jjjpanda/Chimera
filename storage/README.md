# Storage <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The storage server handles file storage:
1. Saving motion-detected camera images
2. Generating videos and archives for download
3. File deletion, metrics, and stats
4. Serving those files

Run storage on the same machine as [motion](https://github.com/Motion-Project/motion), which saves RTSP frames and writes each one (with size) to the `frame_files` table. Motion's `sql_query` can't capture file size, so we shell out via `on_picture_save`:

```
picture_type jpeg
picture_filename %t/%Y%m%d-%H%M%S-%q

on_picture_save SZ=$(wc -c %f | head -n1 | awk '{print $1;}'); PGPASSWORD="$database_PASSWORD" psql -h postgres -U "$database_USER" -d "$database_NAME" -c "INSERT INTO frame_files(timestamp, camera, name, size) VALUES(now(), %t, '%Y%m%d-%H%M%S-%q.jpg', $SZ);"
```

`postgresql-client` ships in the chimera image; `database_*` come from `.env`. See [`motion.conf.example`](../motion.conf.example) for the full Docker-ready config. [ffmpeg](https://ffmpeg.org) is required for generating videos.

---
# Routes

## ▶ /

Mounted at the root (`routes/events.js`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/events|Paginated list of saved frames for a camera on a date|Query `camera_id`, `date` (`YYYY-MM-DD`), `page`, `per_page` (max 1000)|`{ events: [{ id, timestamp, name, size }], total, page, per_page }`|
|GET|/frames/:camera_id/:filename|Serves a saved frame image|Path `camera_id`, `filename`|jpg (400 if `camera_id` non-numeric or `filename` invalid; 404 if missing)|
|GET|/usage|Storage usage summary across cameras and artifact types|None|`{ used_gb, max_gb, cameras: [{ id, name, used_gb, frame_count }], total_frames, breakdown: { frames, videos, zips, objects, other } }`|
|DELETE|/camera/:id|Purge a camera's frames, detected objects, and files|Path `id`|`{ deleted: true }`|

## ▶ /motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|pm2 status of the bundled motion process|None|`[{ name, status, restarts }]`, or 204 if not running|

## ▶ /database

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Postgres connectivity check (`SELECT 2 + 2`)|None|200 `{}` if healthy, else 204|

## ▶ /convert

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/listFramesVideo|Sends a list of links to images for scrubbing|`{ camera: Number, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, frames: Number }`|`{ list: [ String ] }`|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/statusProcess|Get status of video or zip process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelProcess|Cancel running video or zip process|`{ id: String }`|`{ cancelled: Boolean, id: String }`|
|GET|/listProcess|Get list of all processes|None|`{ list: [ ProcessObj ] }`|
|POST|/deleteProcess|Delete video or zip by given ID|`{ id: String }`|`{ deleted: Boolean, id: String }`|

### ProcessObj

```javascript
// fileName = output_[cameraNumber]_[startDateTime]_[endDateTime]_[ID].[type]

// id = [RandomAlphaNumeric]-[requestDateTime]

// dateTime = YYYYMMDD-hhmmss (0-23 hour clock)

//ProcessObj
{
    link: String // gateway_HOST/shared/captures/[fileName]
    type: String // mp4, zip, etc
    id: String, // id
    requested: String, //dateTime
    camera: Number,
    start: String,  // dateTime,
    end: String, //dateTime,
    running: Boolean,
    size: Number // bytes, null if the file stat failed
}
```

## ▶ /file

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/pathSize|Gets folder or file size|`{ camera: Number }`|`{ size: String }`|
|POST|/pathFileCount|Gets folder's file count|`{ camera: Number }`|`{ count: String }`|
|POST|/pathDelete|Delete a camera's folder and its frame rows (records to `frame_deletes`)|`{ camera: Number }`|`{ deleted: Boolean }`|
|POST|/pathClean|Delete a camera's files older than N days (records to `frame_deletes`)|`{ camera: Number, days: Number }`|`{ deleted: Boolean }`|
|GET|/pathStats|Hourly totals of stored bytes per camera (all time)|None|`[{ timestamp: Number, [camera_name]: Number }]`|
|GET|/dailyStats|Per-minute totals of stored bytes per camera over the last 24h|None|`[{ timestamp: Number, [camera_name]: Number }]`|
|POST|/pathMetrics|Per-camera total size and frame count|None|`{ size: { [camera_name]: String }, count: { [camera_name]: String } }`|
|POST|/pathAutoClean|Enforce `storage_MAX_GB`: when capture+object usage exceeds 90% of the cap, delete the oldest frames (disk + `frame_files`) until under target; alerts the admin webhook if non-frame artifacts dominate|None|`{ cleaned: Boolean, deleted: Number }` / `{ skipped: true }` / `{ cleaned: false }`|

## ▶ /shared

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/directory/example.mp4|Downloads the specified file|None|mp4|

## ▶ /storage

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|

---
# How it fits

`server.js` starts storage under pm2 when `storage_ON=true` (listening on `storage_PORT`); pm2 also launches the bundled `motion` process, which writes a row to `frame_files` for every saved frame. The [gateway](../gateway) proxies it when `storage_PROXY_ON=true`.

Every route except `/storage/health` sits behind `auth.createAuthorize(pool)` from [lib](../lib), so a valid session is required; a subset additionally uses `requireAdmin` (`/convert` mutations — createVideo/createZip/statusProcess/cancelProcess/deleteProcess, `/file/pathDelete`, `/file/pathClean`, `/file/pathAutoClean`, and `DELETE /camera/:id`).

Postgres usage: reads/writes `frame_files` (per-frame rows written by motion), writes `frame_deletes` (deletion audit of size/count) from `pathDelete`/`pathClean`, and deletes matching `objects_detected` rows when purging a camera. On the prime pm2 instance, storage prunes `frame_deletes` rows older than 30 days (`startDbPruning`). The [schedule](../schedule) service periodically POSTs `/file/pathAutoClean` when `storage_MAX_GB` is set, enforcing the quota.

Config comes from `storage_*`, `database_*`, `storage_FOLDERPATH`, `storage_MAX_GB`, and the alert webhook keys — see [../env.example](../env.example).
