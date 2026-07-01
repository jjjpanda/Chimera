# Livestream <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The livestream server serves and monitors the per-camera HLS video streams. It does **not** transcode: the RTSP→HLS conversion is done by separate per-camera ffmpeg processes; this Node server serves their segments, reports each camera's stream status, and can restart a camera's stream.

[ffmpeg](https://ffmpeg.org) must be installed (on `PATH`) for the streams to start.

---
# Routes
## ▶ /livestream

`/status`, `/restart`, and `/feed` sit behind [lib](../lib) `auth.createAuthorize(pool)`, so a valid session is required; `/health` is public.

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|pm2 status of every camera's HLS process (`live_stream_cam_*`)|None|`[{name, status, restarts}]`, or `204` if none running|
|GET|/status?camera={camera id}|pm2 status of one camera's HLS process|`camera` query = camera id|`[{name, status, restarts}]`, or `204` if not running|
|POST|/restart|Restart one camera's ffmpeg HLS process|`{ camera: Number }`|`{}` (`400` if `camera` omitted)|
|GET|/feed/{camera id}/video.m3u8|HLS playlist for a camera (rolling `.ts` segments served alongside)|None|`video.m3u8` (HLS playlist)|
|GET|/health|Confirms server alive|N/A|N/A|

---
# Transcoding (division of labor)

When `livestream_ON=true`, pm2 ([pm2.config.js](../pm2.config.js)) spawns one ffmpeg process per configured camera — named `live_stream_cam_<id>` — reading the camera's RTSP feed over TCP and writing a rolling HLS playlist (`video.m3u8` plus short `.ts` segments) to `livestream_FOLDERPATH/feed/<id>/`. Cameras come from [cameraconf/*.conf](../cameraconf) via [lib](../lib) `loadCameras`.

This Node server:
- serves those files statically at `/livestream/feed/<id>/video.m3u8`,
- reports each camera's ffmpeg process status via `/status` (querying pm2), and
- restarts a camera's ffmpeg process via `/restart` (via pm2).

On startup it checks for at least one `live_stream_cam` process and logs a warning if none is running.

---
# How it fits

- `server.js` starts this service under pm2 when `livestream_ON=true`.
- The [gateway](../gateway) reverse-proxies it when `livestream_PROXY_ON=true`.
- It owns no Postgres tables; session validation reads the `sessions`/`auth` tables owned by [command](../command) through [lib](../lib) auth.
- Config: `livestream_ON`, `livestream_PORT`, `livestream_HOST`, `livestream_FOLDERPATH`, `livestream_PROXY_ON`, plus the `ffmpeg` requirement — see [../env.example](../env.example).
