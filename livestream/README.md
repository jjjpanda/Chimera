# Livestream <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The livestream server handles transcoding the RTSP camera feed into a HLS stream.

[ffmpeg](https://ffmpeg.org) is required to start HLS stream.

---
# Routes
## ▶ /livestream

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status| | | |
|GET|/status?camera={camera number}| | | |
|GET|/feed/{camera number}/video.m3u8|Live stream file|None|mp4|
|POST|/restart|restart live stream file|`{ camera: Number }`|N/A|
|GET|/health|Confirms server alive|N/A|N/A|
