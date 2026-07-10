# Storage <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Saves motion-detected camera frames, serves them, builds downloadable videos/zips, and handles deletion, metrics, and stats.

Runs on the same machine as [motion](https://github.com/Motion-Project/motion), which saves RTSP frames and logs each to `frame_files`. Motion can't capture file size in `sql_query`, so `on_picture_save` shells out to `psql` after each save. `postgresql-client` ships in the image; `database_*` from `.env`. Full config: [motion.conf.example](../motion.conf.example). Needs [ffmpeg](https://ffmpeg.org) for video generation.

---
# API

Session-guarded (`authorize`) except `/storage/health`; video/zip creation, deletion, and quota cleanup also require admin (`requireAdmin`):

- browse and serve saved frames
- storage usage, per-camera size/count, time-series stats
- build/manage downloadable videos and zips by timestamp, then serve them
- delete camera files and rows; enforce the `storage_MAX_GB` quota
- check the motion process and Postgres connectivity

---
# Runtime

- pm2 runs storage (`storage/start.js`) + the bundled `motion` when `storage_ON=true`; [gateway](../gateway) proxies when `storage_PROXY_ON=true`.
- `frame_deletes` logs manual deletions (`pathDelete` / `pathClean`), not quota auto-clean; the prime instance prunes rows older than 30 days.
- [schedule](../schedule) POSTs `/file/pathAutoClean` when `storage_MAX_GB` is set.

---
# Config

`storage_*`, `database_*`, `storage_FOLDERPATH`, `storage_MAX_GB`, alert webhook keys; see [../env.example](../env.example).
