# Storage <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Saves motion-detected camera frames, serves them, generates downloadable videos and zip archives, and handles file deletion, metrics, and stats.

Run storage on the same machine as [motion](https://github.com/Motion-Project/motion), which saves RTSP frames and writes each frame's name and size to the `frame_files` table. Motion's `sql_query` can't capture file size, so `on_picture_save` shells out:

```
picture_type jpeg
picture_filename %t/%Y%m%d-%H%M%S-%q

on_picture_save SZ=$(wc -c %f | head -n1 | awk '{print $1;}'); PGPASSWORD="$database_PASSWORD" psql -h postgres -U "$database_USER" -d "$database_NAME" -c "INSERT INTO frame_files(timestamp, camera, name, size) VALUES(now(), %t, '%Y%m%d-%H%M%S-%q.jpg', $SZ);"
```

`postgresql-client` ships in the chimera image; `database_*` come from `.env`. Full Docker-ready config: [`motion.conf.example`](../motion.conf.example). [ffmpeg](https://ffmpeg.org) is required for video generation.

---
# API

Routes are session-guarded (`authorize`); creating videos and zips, deleting files, and quota cleanup additionally require admin (`requireAdmin`). `/storage/health` is public.

The API browses and serves saved frames, reports storage usage plus per-camera size/count and time-series stats, builds and manages downloadable videos and zips from frames by timestamp (then serves them for download), deletes camera files and rows, enforces the `storage_MAX_GB` quota, and checks the bundled motion process and Postgres connectivity.

---
# Runtime

- `server.js` runs storage under pm2 when `storage_ON=true` (port `storage_PORT`); pm2 also launches the bundled `motion` process. [gateway](../gateway) proxies it when `storage_PROXY_ON=true`.
- `frame_deletes` logs deleted size/count; on the prime pm2 instance `startDbPruning` prunes its rows older than 30 days.
- [schedule](../schedule) periodically POSTs `/file/pathAutoClean` when `storage_MAX_GB` is set.

---
# Config

- `storage_*`, `database_*`, `storage_FOLDERPATH`, `storage_MAX_GB`, alert webhook keys; see [../env.example](../env.example).
