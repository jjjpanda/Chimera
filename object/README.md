# Object <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Runs YOLOX inference on the camera HLS feeds, records detections to `objects_detected`, and fires webhook alerts (`alert_URL`).

---
# API

Session-guarded (`authorize`) except `/object/health`; config updates and on-demand scans also require admin (`requireAdmin`):

- current config and per-camera worker status
- update detection config (confidence, interval, classes)
- scan a camera on demand
- query recent detections + their capture frames

---
# Runtime

- Started by root `server.js` when `object_ON=true`; [gateway](../gateway) proxies when `object_PROXY_ON=true`.
- The prime instance scans each camera every `object_INTERVAL_MS`, writes to `objects_detected`, and prunes captures to `object_MAX_CAPTURES`.
- With `memory_ON=true`, config/status/scan route through the [memory](../memory) socket (as the `OBJECT` client).
- YOLOX-Tiny ONNX (~20MB) fetched to `backend/model/yolox_tiny.onnx` on first boot; override with `object_MODEL_URL`.
- Auth and camera loading from [lib](../lib).

---
# Config

`object_*` keys in [env.example](../env.example). Loads cameras via `storage_MOTION_CONF_FILEPATH`; reuses `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, `database_*`, `storage_FOLDERPATH` (holds `objectCaptures/`).
