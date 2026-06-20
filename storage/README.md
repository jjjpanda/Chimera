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

## ▶ /motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status| | | |
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
    link: String // /shared/captures/[fileName]
    type: String // mp4, zip, etc
    id: String, // id
    requested: String, //dateTime
    camera: Number,
    start: String,  // dateTime,
    end: String, //dateTime,
    running: Boolean
}
```

## ▶ /file

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/pathStats|Gets addition stats| | |
|POST|/pathSize|Gets folder or file size|`{ camera: Number }`|`{ size: String }`|
|POST|/pathFileCount|Gets folder's file count|`{ camera: Number }`|`{ count: Number }`|
|POST|/pathMetrics| | | |
|POST|/pathDelete|Delete folder or file by path|`{ camera: Number }`|`{ deleted: Boolean }`|
|POST|/pathClean|Deletes older files or files in directory given a number of days|`{ camera: Number, days: Number }`|`{ deleted: Boolean }`|

## ▶ /shared

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/directory/example.mp4|Downloads the specified file|None|mp4|

## ▶ /storage

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|