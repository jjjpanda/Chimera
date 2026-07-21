# Docker secrets (opt-in)

Keeps `SECRETKEY`, `scheduler_AUTH`, `setup_TOKEN`, `memory_AUTH_TOKEN`,
`database_PASSWORD`, `alert_URL` and `admin_alert_URL` out of `docker inspect`
and out of the environment inherited by `motion`, `ffmpeg` and `psql`.

## 1. Write one file per key

Named after the env var, containing only the value:

```
printf '%s' 'my-secret-value' > secrets/SECRETKEY
chmod 440 secrets/SECRETKEY
```

The container reads them as uid 1000 (`node`), so `440` works when your account
is uid 1000 (the default first user on Raspberry Pi OS / Ubuntu / Debian).
Otherwise `sudo chown 1000:1000` the file, or use `644`.

All seven files are required — the overlay attaches every secret to `chimera`
unconditionally, and compose does not check a missing `file:` target: it mounts
an empty directory over `/run/secrets/<KEY>` and starts anyway.

`database_PASSWORD` must have no leading/trailing whitespace and no extra lines
— postgres keeps them, the app strips them, and you get a silent "password
authentication failed". The `printf '%s'` form above avoids it. **Changing it
later needs `npm run docker:delete`**: postgres reads it only at init, so
`up:secrets` keeps the old volume and the new value fails auth.

## 2. Blank those keys in `.env`

Anything left there is loaded into the container and shown by `docker inspect`.
The file wins either way — the app reads `<KEY>_FILE` — so a leftover value is
inert, just pointless. Preflight validates whichever file exists.

If your `motion.conf` predates this, copy the current `on_picture_save` line
from `motion.conf.example`; the old one reads `$database_PASSWORD` only.

## 3. Run with the `:secrets` variants

```
npm run docker:up:secrets      # or docker:rebuild:secrets
```

This directory is gitignored — never commit real secret files.
