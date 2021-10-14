# Livestream <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The livestream server handles transcoding the RTSP camera feed into a HLS stream.

## ▶ /livestream

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status| | | |
|GET|/feed/{camera number}/video.m3u8|Live stream file|None|mp4|