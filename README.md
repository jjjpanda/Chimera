# MotionPlayback

## API

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/|Serves main website|None|html|
|GET|/shared|Link to file storage|None|html|
|GET|/shared/example.mp4|Downloads the specified file|None|mp4|
|POST|/motionStart|Start motion recording|None|SSH Command Response|
|POST|/motionStop|Stop motion recording|None|SSH Command Response|
|POST|/motionStatus|Get motion status|None|SSH Command Response|
|POST|/serverUpdate|Update machine running command server|None|SSH Command Response|
|POST|/serverStatus|Get command server status|None|SSH Command Response|
|POST|/folderSize|Gets folder size|`{ path: String }`|`{ size: Number }`|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, fps: Number, start: Date | YYYYMMDD-HHMMSS, end: Date | YYYYMMDD-HHMMSS }`|`{ id: String, url: String }`|


### SSH Command Responses

```javascript
{
    code: 0 | 1,
    sent: true | false,
    output: "command output",
    error: "command error output"
}
```
