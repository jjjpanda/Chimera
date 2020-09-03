# MotionPlayback

## API

### Media Server

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/mediaOn|Description|None|`{  }`|
|POST|/mediaStatus|Description|None|`{  }`|
|POST|/mediaOff|Description|None|`{  }`|

### Web DAV

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/webdavOn|Description|None|`{  }`|
|POST|/webdavStatus|Description|None|`{  }`|
|POST|/webdavOff|Description|None|`{  }`|
|PROPFIND|/webdav|Serves WebDAV (Note: WebDav is on a different port)|Multi|Multi|

### Converter

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/listFramesVideo|Sends a list of links to images for scrubbing|`{ camera: Number, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, frames: Number }`|`{ list: [ String ] }`|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/statusProcess|Get status of video or zip process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelProcess|Cancel running video or zip process|`{ id: String }`|`{ cancelled: Boolean, id: String }`|
|POST|/listProcess|Get list of all processes|None|`{ list: [ ProcessObj ] }`|
|POST|/deleteProcess|Delete video or zip by given ID|`{ id: String }`|`{ deleted: Boolean, id: String }`|
|GET|/shared|Link to file storage|None|html|
|GET|/shared/example.mp4|Downloads the specified file|None|mp4|

### Scheduler 

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/taskSchedule|Schedules a request for another command server request|`{ url: String, body: JSON, cronString: String }`|`{ cronString: String, set: Boolean, destroyed: Boolean }`|
|POST|/taskCheck|Checks details of tasks|`{ url: String }`|`{ cronString: String, set: Boolean }`
|POST|/taskDestroy|Destroys a scheduled request process|`{ url: String }`|`{ set: Boolean, destroyed: Boolean }`|

### Commander

1. Motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/motionStart|Start motion recording|None|`{ sent: Boolean }`|
|POST|/motionStatus|Get motion status|None|`{ running: Boolean, duration: String }`|
|POST|/motionStop|Stop motion recording|None|`{ sent: Boolean }`|

2. Server

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/serverUpdate|Update machine accepting commands|None|`{ sent: Boolean }`|
|POST|/serverInstall|Install dependencies in machine accepting commands|None|`{ sent: Boolean }`|
|POST|/serverStatus|Get command server status|None|`{ running: Boolean, duration: String }`|
|POST|/serverStop|Stop command server|None|`{ sent: Boolean }`|

3. Path

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/pathSize|Gets folder or file size|`{ path: String }`|`{ size: String }`|
|POST|/pathFileCount|Gets folder's file count|`{ path: String }`|`{ count: Number }`|
|POST|/pathDelete|Delete folder or file by path|`{ path: String }`|`{ deleted: Boolean }`|
|POST|/pathClean|Deletes older files or files in directory given a number of days|`{ path: String, days: Number }`|`{ deleted: Boolean }`|

4. Web

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/|Serves main website|None|html|
|GET|/legacy|Serves legacy website|None|html|

### SSH Command Responses

```javascript
{
    code: 0 | 1,
    sent: true | false,
    output: "command output",
    error: "command error output"
}
```

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
