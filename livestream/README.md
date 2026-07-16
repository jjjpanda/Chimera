# Livestream <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Serves and monitors per-camera HLS streams. RTSP→HLS transcoding runs in separate ffmpeg processes, not here.

---
# API

Session-guarded (`authorize`) except `/livestream/health`:

- pm2 status for all cameras or one
- restart a camera's ffmpeg process
- serve each camera's HLS playlist (`/livestream/feed/<id>/video.m3u8`)

---
# Runtime

- pm2 spawns one ffmpeg per camera (`live_stream_cam_<id>`) when `livestream_ON=true`: RTSP-over-TCP → rolling HLS in `livestream_FOLDERPATH/feed/<id>/`. Runs `ffmpeg_FILEPATH`, falling back to `ffmpeg` on `PATH`.
- Cameras load from [cameraconf/*.conf](../cameraconf) via [lib](../lib) `loadCameras`, resolved through `storage_MOTION_CONF_FILEPATH`.
- Launched by pm2 (`livestream/start.js`) when `livestream_ON=true`; [gateway](../gateway) proxies when `livestream_PROXY_ON=true`.
- No tables; sessions validated against [command](../command)'s `auth`/`sessions` via [lib](../lib).

---
# Config

`livestream_ON`, `livestream_PORT`, `livestream_HOST`, `livestream_FOLDERPATH`, `livestream_PROXY_ON`, `ffmpeg_FILEPATH`, `storage_MOTION_CONF_FILEPATH`; see [../env.example](../env.example).
