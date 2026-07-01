# Livestream <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Serves and monitors per-camera HLS video streams; RTSP→HLS transcoding runs in separate per-camera ffmpeg processes, not here.

[ffmpeg](https://ffmpeg.org) must be on `PATH` for streams to start.

---
# API

Session-guarded (`authorize`) except `/health`. The API reports pm2 status for all cameras' HLS processes or a single camera, restarts a camera's ffmpeg process, and serves each camera's rolling HLS playlist (`/feed/<id>/video.m3u8`).

---
# Streams

- pm2 ([pm2.config.js](../pm2.config.js)) spawns one ffmpeg per configured camera (`live_stream_cam_<id>`) when `livestream_ON=true`, reading RTSP over TCP and writing rolling HLS (`video.m3u8` + `.ts`) to `livestream_FOLDERPATH/feed/<id>/`.
- Cameras load from [cameraconf/*.conf](../cameraconf) via [lib](../lib) `loadCameras`.
- On startup, warns if no `live_stream_cam` process is running.
- Started by `server.js` under pm2 when `livestream_ON=true`; [gateway](../gateway) reverse-proxies it when `livestream_PROXY_ON=true`.
- Owns no Postgres tables; session validation reads [command](../command)'s `sessions`/`auth` tables via [lib](../lib) `auth.createAuthorize(pool)`.

---
# Config

`livestream_ON`, `livestream_PORT`, `livestream_HOST`, `livestream_FOLDERPATH`, `livestream_PROXY_ON`; requires `ffmpeg`. See [../env.example](../env.example).
