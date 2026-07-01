# Storage <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Saves motion-detected camera frames, serves them, generates downloadable videos and zip archives, and handles file deletion, metrics, and stats.

Run storage on the same machine as [motion](https://github.com/Motion-Project/motion), which saves RTSP frames and writes each frame's name and size to the `frame_files` table. Motion's `sql_query` can't capture file size, so `on_picture_save` shells out:

```
picture_type jpeg
picture_filename %t/%Y%m%d-%H%M%S-%q

on_picture_save SZ=$(wc -c %f | head -n1 | awk '{print $1;}'); PGPASSWORD="$database_PASSWORD" psql -h postgres -U "$database_USER" -d "$database_NAME" -c "INSERT INTO frame_files(timestamp, camera, name, size) VALUES(now(), %t, '%Y%m%d-%H%M%S-%q.jpg', $SZ);"
```

`postgresql-client` ships in the chimera image; `database_*` come from `.env`. Full Docker-ready config: [`motion.conf.example`](../motion.conf.example). [ffmpeg](https://ffmpeg.org) is required for video generation.

---
# Routes

`auth` = session (`authorize`); `admin` = session + admin (`requireAdmin`); `none` = public.

## ▶ /

Mounted at the root (`routes/events.js`).

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/events|auth|Paginated frames for a camera on a date|Query `camera_id`, `date` (`YYYY-MM-DD`), `page`, `per_page` (max 1000)|`{ events: [{ id, timestamp, name, size }], total, page, per_page }`|
|GET|/frames/:camera_id/:filename|auth|Serves a frame image|Path `camera_id`, `filename`|jpg (400 if `camera_id` non-numeric or `filename` invalid; 404 if missing)|
|GET|/usage|auth|Usage summary across cameras and artifact types|None|`{ used_gb, max_gb, cameras: [{ id, name, used_gb, frame_count }], total_frames, breakdown: { frames, videos, zips, objects, other } }`|
|DELETE|/camera/:id|admin|Purge a camera's frames, `objects_detected` rows, and files|Path `id`|`{ deleted: true }`|

## ▶ /motion

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/status|auth|pm2 status of the bundled motion process|None|`[{ name, status, restarts }]`, or 204 if not running|

## ▶ /database

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/status|auth|Postgres connectivity check (`SELECT 2 + 2`)|None|200 `{}` if healthy, else 204|

## ▶ /convert

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|POST|/createVideo|admin|Create video from frames by timestamp|`{ camera: Number, fps: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/listFramesVideo|auth|List frame links for scrubbing|`{ camera: Number, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, frames: Number }`|`{ list: [ String ] }`|
|POST|/createZip|admin|Create zip archive from frames by timestamp|`{ camera: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/statusProcess|admin|Status of a video/zip process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelProcess|admin|Cancel a running video/zip process|`{ id: String }`|`{ cancelled: Boolean, id: String }`|
|GET|/listProcess|auth|List all processes|None|`{ list: [ ProcessObj ] }`|
|POST|/deleteProcess|admin|Delete a video/zip by ID|`{ id: String }`|`{ deleted: Boolean, id: String }`|

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

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|POST|/pathSize|auth|Folder or file size|`{ camera: Number }`|`{ size: String }`|
|POST|/pathFileCount|auth|Folder file count|`{ camera: Number }`|`{ count: String }`|
|POST|/pathDelete|admin|Delete a camera's folder and frame rows (records to `frame_deletes`)|`{ camera: Number }`|`{ deleted: Boolean }`|
|POST|/pathClean|admin|Delete a camera's files older than N days (records to `frame_deletes`)|`{ camera: Number, days: Number }`|`{ deleted: Boolean }`|
|GET|/pathStats|auth|Hourly totals of stored bytes per camera (all time)|None|`[{ timestamp: Number, [camera_name]: Number }]`|
|GET|/dailyStats|auth|Per-minute totals of stored bytes per camera over last 24h|None|`[{ timestamp: Number, [camera_name]: Number }]`|
|POST|/pathMetrics|auth|Per-camera total size and frame count|None|`{ size: { [camera_name]: String }, count: { [camera_name]: String } }`|
|POST|/pathAutoClean|admin|Enforce `storage_MAX_GB`: when capture+object usage exceeds 90% of cap, delete oldest frames (disk + `frame_files`) until under target; alerts admin webhook if non-frame artifacts dominate|None|`{ cleaned: Boolean, deleted: Number }` / `{ skipped: true }` / `{ cleaned: false }`|

## ▶ /shared

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/directory/example.mp4|auth|Downloads the specified file|None|mp4|

## ▶ /storage

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/health|none|Confirms server alive|N/A|N/A|

---
# Runtime

- `server.js` runs storage under pm2 when `storage_ON=true` (port `storage_PORT`); pm2 also launches the bundled `motion` process. [gateway](../gateway) proxies it when `storage_PROXY_ON=true`.
- `frame_deletes` logs deleted size/count; on the prime pm2 instance `startDbPruning` prunes its rows older than 30 days.
- [schedule](../schedule) periodically POSTs `/file/pathAutoClean` when `storage_MAX_GB` is set.

---
# Config

- `storage_*`, `database_*`, `storage_FOLDERPATH`, `storage_MAX_GB`, alert webhook keys; see [../env.example](../env.example).
