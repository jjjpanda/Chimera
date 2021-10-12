# Storage <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

## ▶ /convert

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/createVideo|Creates videos from images based on timestamps|`{ camera: Number, fps: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/listFramesVideo|Sends a list of links to images for scrubbing|`{ camera: Number, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, frames: Number }`|`{ list: [ String ] }`|
|POST|/createZip|Creates zip archive from images based on timestamps|`{ camera: Number, save: Boolean, start: Date or YYYYMMDD-HHMMSS, end: Date or YYYYMMDD-HHMMSS, skip: Number }`|`{ id: String, url: String, frameLimitMet: Boolean }`|
|POST|/statusProcess|Get status of video or zip process|`{ id: String }`|`{ running: Boolean, id: String }`|
|POST|/cancelProcess|Cancel running video or zip process|`{ id: String }`|`{ cancelled: Boolean, id: String }`|
|POST|/listProcess|Get list of all processes|None|`{ list: [ ProcessObj ] }`|
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
|POST|/pathSize|Gets folder or file size|`{ path: String }`|`{ size: String }`|
|POST|/pathFileCount|Gets folder's file count|`{ path: String }`|`{ count: Number }`|
|POST|/pathDelete|Delete folder or file by path|`{ path: String }`|`{ deleted: Boolean }`|
|POST|/pathClean|Deletes older files or files in directory given a number of days|`{ path: String, days: Number }`|`{ deleted: Boolean }`|

## ▶ /motion

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/status| | | |
## ▶ /livestream

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/status| | | |
|POST|/list| | | |
## ▶ /shared

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/directory|Opens 'directory' as web page|None|html|
|GET|/directory/example.mp4|Downloads the specified file|None|mp4|