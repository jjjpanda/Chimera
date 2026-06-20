# Object <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The object server runs native [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) inference over the camera HLS feeds, records detections, and fires webhook alerts. The YOLOX-Tiny ONNX model (~20MB) is fetched to `backend/model/yolox_tiny.onnx` on first boot.

---
# Routes
## ▶ /object

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/status|Current config + per-camera worker status|None|JSON|
|GET|/detections|Recent detections from the database|`camera`, `limit`|JSON|
|GET|/config|Current detection config|None|JSON|
|POST|/config|Update detection config (admin)|`{ confidence, intervalMs, classes }`|JSON|
|POST|/scan|Force an immediate scan (admin)|`{ camera }`|JSON|
|GET|/captures/{file}|Detection frame referenced by `image` in `/detections`|None|jpg|
|GET|/health|Confirms server alive|N/A|N/A|

## Env

See [`env.example`](../env.example) for `object_*` keys. Reuses `cameras`, `livestream_FOLDERPATH`, `ffmpeg_FILEPATH`, `alert_URL`, `database_*`, and `storage_FOLDERPATH` (where `objectCaptures/` is written).
