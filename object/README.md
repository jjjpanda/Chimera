# Object <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Runs YOLOX inference on the camera HLS feeds, records detections to the `objects_detected` table, and fires webhook alerts via `alert_URL`.

---
# Routes
## ▶ /object

All routes need a session (`authorize`) except `/health` (public); `POST /config` and `POST /scan` also need admin (`requireAdmin`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Config + per-camera worker status|None|`{config, cameras, cameraNames}`|
|GET|/config|Current detection config|None|JSON|
|POST|/config|Update detection config (admin)|`{confidence, intervalMs, classes}`|JSON|
|POST|/scan|Scan one camera now (admin)|`{camera}`|`{camera, detections}`|
|GET|/detections|Recent detections (`id, camera, timestamp, type, confidence, box, image`)|`camera`, `start`, `end`, `limit` (default 50, max 500)|JSON[]|
|GET|/captures/{file}|Detection frame from `image` in `/detections`|None|jpg|
|GET|/health|Server alive|N/A|N/A|

---
# Runtime

- Started by `server.js` under pm2 when `object_ON=true`; proxied by the [gateway](../gateway) when `object_PROXY_ON=true`.
- Prime instance scans each camera every `object_INTERVAL_MS`, writes detections to the `objects_detected` Postgres table, and prunes captures to `object_MAX_CAPTURES`.
- Auth and camera loading come from [lib](../lib) (`auth`, `loadCameras`).
- With `memory_ON=true`, config/status/scan route through the [memory](../memory) socket (`OBJECT` namespace) to coordinate a pm2 cluster.
- YOLOX-Tiny ONNX model (~20MB) fetched to `backend/model/yolox_tiny.onnx` on first boot; override the source with `object_MODEL_URL`.

---
# Config

`object_*` keys in [`env.example`](../env.example). Loads cameras via `storage_MOTION_CONF_FILEPATH`; reuses `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, `database_*`, and `storage_FOLDERPATH` (holds `objectCaptures/`).
