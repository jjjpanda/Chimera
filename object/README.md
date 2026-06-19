# object

People/object detection microservice. Runs native [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) inference over camera HLS feeds and records detections + fires webhook alerts.

Uses `onnxruntime-node` for inference, YOLOX-Tiny ONNX (~20MB, Apache-2.0) downloaded on first boot, and `ffmpeg` for frame extraction.

## Routes (`/object`, proxied through the gateway)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/object/health` | Heartbeat |
| GET | `/object/status` | Current config + per-camera worker status |
| GET | `/object/detections?camera=&limit=` | Recent detections from the database |
| GET | `/object/config` | Current detection config |
| POST | `/object/config` | Update `{ confidence, intervalMs, classes }` (admin) |
| POST | `/object/scan` | Force an immediate scan of `{ camera }` (admin) |
| GET | `/object/captures/<file>` | Letterboxed detection frame referenced by `image` in `/detections` |

## Env

See [`env.example`](../env.example) — `object_ON`, `object_PORT`, `object_HOST`, `object_PROXY_ON`, `object_CONFIDENCE`, `object_INTERVAL_MS`, `object_MODEL_URL`, `object_INPUT_SIZE`, `object_ALERT_ON`, `object_MAX_CAPTURES`. Reuses `cameras`, `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, `database_*`, and `storage_FOLDERPATH` (controls where `objectCaptures/` is written; defaults to `cwd`).
