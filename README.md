# MotionPlayback

## API

### Static Routes & Files

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/|Serves main website|None|html|
|GET|/shared|Link to file storage|None|html|
|GET|/shared/example.mp4|Downloads the specified file|None|mp4|
|POST|/folderSize|Gets folder size|`{ path: String }`|`{ size: Number }`|
|POST|/deleteFile|Delete file by path|`{ path: String }`|`{ deleted: true }`|
|POST|/deleteFolder|Delete folder by path|`{ path: String }`|`{ deleted: true }`|

### Motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/motionStart|Start motion recording|None|SSH Command Response|
|POST|/motionStop|Stop motion recording|None|SSH Command Response|
|POST|/motionStatus|Get motion status|None|SSH Command Response|

### Command Server

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/serverUpdate|Update machine running command server|None|SSH Command Response|
|POST|/serverStatus|Get command server status|None|SSH Command Response|

### Video Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/cancelVideo|Cancel running video process|`{ id: String }`|`{ cancelled: true }`|
|POST|/deleteVideo|Delete video by given ID|`{ id: String }`|`{ deleted: Boolean }`|

### Archive Conversions

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/cancelZip|Cancel running zip process|`{ id: String }`|`{ cancelled: true }`|
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
