# Object <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The object server runs native [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) inference over the camera HLS feeds, records detections to the `objects_detected` table, and fires webhook alerts via `alert_URL`. The YOLOX-Tiny ONNX model (~20MB) is fetched to `backend/model/yolox_tiny.onnx` on first boot (override the source with `object_MODEL_URL`).

---
# Routes
## ▶ /object

Every route is mounted behind `authorize` (valid session required) except `/health`, which is public. `POST /config` and `POST /scan` additionally require an admin role (`requireAdmin`).

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Current config + per-camera worker status|None|`{config, cameras, cameraNames}`|
|GET|/config|Current detection config|None|JSON|
|POST|/config|Update detection config (admin)|`{confidence, intervalMs, classes}`|JSON|
|POST|/scan|Force an immediate scan of one camera (admin)|`{camera}`|`{camera, detections}`|
|GET|/detections|Recent detections (`id, camera, timestamp, type, confidence, box, image`)|`camera`, `start`, `end`, `limit` (default 50, max 500)|JSON[]|
|GET|/captures/{file}|Detection frame referenced by `image` in `/detections`|None|jpg|
|GET|/health|Confirms server alive|N/A|N/A|

## How it fits

`server.js` starts this service under pm2 when `object_ON=true`; the [gateway](../gateway) proxies it when `object_PROXY_ON=true`. On the prime instance it runs per-camera scan loops every `object_INTERVAL_MS`, writing each detection to the `objects_detected` Postgres table and pruning capture images to `object_MAX_CAPTURES`. Auth middleware and camera loading come from [lib](../lib) (`auth`, `loadCameras`); when `memory_ON=true` config/status/scan are brokered through the [memory](../memory) socket (`OBJECT` namespace) so a pm2 cluster stays coordinated.

## Env

See [`env.example`](../env.example) for `object_*` keys. Loads cameras via `storage_MOTION_CONF_FILEPATH`, and reuses `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, `database_*`, and `storage_FOLDERPATH` (where `objectCaptures/` is written).
