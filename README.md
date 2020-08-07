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
|POST|/motionStart|Start motion recording|None|SSH Command Response|
|POST|/motionStatus|Get motion status|None|SSH Command Response|
|POST|/motionStop|Stop motion recording|None|SSH Command Response|

### Command Server

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/serverUpdate|Update machine running command server|None|SSH Command Response|
|POST|/serverStatus|Get command server status|None|`{ running: Boolean, duration: String }`|
|POST|/serverStop|Stop command server|None|SSH Command Response|
|POST|/pathSize|Gets folder or file size|`{ path: String }`|`{ size: Number }`|
|POST|/pathDelete|Delete folder or file by path|`{ path: String }`|`{ deleted: Boolean }`|

### Video Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/statusVideo|Get status of video process|`{ id: String }`|`{ running: Boolean }`|
|POST|/cancelVideo|Cancel running video process|`{ id: String }`|`{ cancelled: Boolean }`|
|POST|/deleteVideo|Delete video by given ID|`{ id: String }`|`{ deleted: Boolean }`|

### Archive Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/statusZip|Get status of zip process|`{ id: String }`|`{ running: Boolean }`|
|POST|/cancelZip|Cancel running zip process|`{ id: String }`|`{ cancelled: Boolean }`|
|POST|/deleteZip|Delete zip archive by given ID|`{ id: String }`|`{ deleted: Boolean }`|


### SSH Command Responses

```javascript
{
    code: 0 | 1,
    sent: true | false,
    output: "command output",
    error: "command error output"
}
```
