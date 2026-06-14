# object

People/object detection microservice. Runs native [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) inference over the camera HLS feeds and records detections + fires webhook alerts.

Replaces the old headless-browser + TensorFlow.js/COCO-SSD approach with:

- **`onnxruntime-node`** — native ONNX inference, no browser/Puppeteer
- **YOLOX-Tiny ONNX** (~20MB, **Apache-2.0**) — downloaded on first boot, far more accurate than COCO-SSD. YOLOX is used instead of YOLOv8 because YOLOv8 is AGPL-3.0, which conflicts with Chimera's MIT license.
- **ffmpeg** — frame extraction from the livestream HLS feeds (`livestream_FOLDERPATH/feed/<camera>/video.m3u8`)

## How it works

On start (prime pm2 instance only), one loop per camera runs every `object_INTERVAL_MS`:

1. `ffmpeg` grabs the latest frame → a JPEG (for the alert) + a letterboxed (pad-114) `object_INPUT_SIZE` square raw `bgr24` buffer (for inference), written to `objectTemp/`
2. The raw buffer is fed to YOLOX via `onnxruntime-node` (YOLOX expects raw 0-255 BGR, no normalization; its output is grid-decoded with strides 8/16/32 and scored as `objectness × class`)
3. Detections matching the configured `classes` (default `["person"]`) above `object_CONFIDENCE` are inserted into the `objects_detected` table (with the bounding `box` and the saved frame's `image` name) and, unless `object_ALERT_ON=false`, sent to `alert_URL` with the captured frame attached. The frame is saved letterboxed (`object_INPUT_SIZE` square) to `objectCaptures/` — pruned to the most recent 500 — so detection boxes overlay directly on it in the command **Objects** page

The model is fetched to `backend/model/yolox_tiny.onnx` on first run (not committed). Override the source with `object_MODEL_URL` — if you point it at a different YOLOX size (e.g. `yolox_s`, a 640-input model), set `object_INPUT_SIZE` to match.

## Routes (`/object`, proxied through the gateway)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/object/health` | Heartbeat |
| GET | `/object/status` | Current config + per-camera worker status |
| GET | `/object/detections?camera=&limit=` | Recent detections from the database |
| GET | `/object/config` | Current detection config |
| POST | `/object/config` | Update `{ confidence, intervalMs, classes }` (admin) |
| POST | `/object/scan` | Force an immediate scan of `{ camera }` (admin) |
| GET | `/object/captures/<file>` | Letterboxed detection frame, referenced by `image` in `/detections` (used by the command **Objects** page) |

## Env

See [`env.example`](../env.example) — `object_ON`, `object_PORT`, `object_HOST`, `object_PROXY_ON`, `object_CONFIDENCE`, `object_INTERVAL_MS`, `object_MODEL_URL`, `object_INPUT_SIZE`, `object_ALERT_ON`, `object_MAX_CAPTURES`. All keys must be present in `.env` (`prepare:env` exits 1 if any is missing), but `object_CONFIDENCE`, `object_INTERVAL_MS`, `object_MODEL_URL`, `object_INPUT_SIZE`, `object_ALERT_ON`, and `object_MAX_CAPTURES` may be left blank to use defaults (`object_ALERT_ON` defaults to on; set it to `false` to silence Discord/webhook alerts). Reuses `cameras`, `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, and the `database_*` vars.
