# MotionPlayback

## API

### Static Routes & Files

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/|Serves main website|None|html|
|GET|/shared|Link to file storage|None|html|
|GET|/shared/example.mp4|Downloads the specified file|None|mp4|

### Motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/motionStart|Start motion recording|None|`{ sent: Boolean }`|
|POST|/motionStatus|Get motion status|None|`{ running: Boolean, duration: String }`|
|POST|/motionStop|Stop motion recording|None|`{ sent: Boolean }`|

### Command Server

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/serverUpdate|Update machine running command server|None|`{ sent: Boolean }`|
|POST|/serverStatus|Get command server status|None|`{ running: Boolean, duration: String }`|
|POST|/serverStop|Stop command server|None|`{ sent: Boolean }`|
|POST|/pathSize|Gets folder or file size|`{ path: String }`|`{ size: String }`|
|POST|/pathDelete|Delete folder or file by path|`{ path: String }`|`{ deleted: Boolean }`|

### Video Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/statusVideo|Get status of video process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelVideo|Cancel running video process|`{ id: String }`|`{ cancelled: String }`|
|POST|/listVideo|Get list of all videos|None|`{ list: [ VideoObj ] }`|
|POST|/deleteVideo|Delete video by given ID|`{ id: String }`|`{ deleted: String }`|

### Archive Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/statusZip|Get status of zip process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelZip|Cancel running zip process|`{ id: String }`|`{ cancelled: String }`|
|POST|/listZip|Get list of all zip archives|None|`{ list: [ ZipObj ] }`|
|POST|/deleteZip|Delete zip archive by given ID|`{ id: String }`|`{ deleted: String }`|


### SSH Command Responses

```javascript
{
    code: 0 | 1,
    sent: true | false,
    output: "command output",
    error: "command error output"
}
```

### VideoObj & ZipObj

```javascript
// fileName = output_[cameraNumber]_[startDateTime]_[endDateTime]_[ID]

// id = [RandomAlphaNumeric]_[requestDateTime]

// dateTime = YYYYMMDD-hhmmss (0-23 hour clock)

//VideoObj
{
    link: String // /shared/captures/[fileName].mp4
    id: String, // id,
    camera: Number,
    start: String, // dateTime,
    end: String, //dateTime,
    running: Boolean
}

//ZipObj
{
    link: String // /shared/captures/[fileName].zip
    id: String, // id
    camera: Number,
    start: String,  // dateTime,
    end: String, //dateTime,
    running: Boolean
}
```
