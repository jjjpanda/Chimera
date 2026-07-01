# Object <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Runs YOLOX inference on the camera HLS feeds, records detections to the `objects_detected` table, and fires webhook alerts via `alert_URL`.

---
# API

Session-guarded (`authorize`) except `/health`; updating detection config and triggering an on-demand scan additionally require admin (`requireAdmin`).

The API reports current config and per-camera worker status, updates the detection config (confidence, interval, classes), scans a camera on demand, and queries recent detections along with their capture frames.

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
