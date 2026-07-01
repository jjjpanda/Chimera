# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

Serves the web app and handles authentication, RBAC, and session management.

---
# API

Three access levels: public, session-required (`authorize`), and admin-only (`requireAdmin`). Authentication, RBAC, and sessions all live here — other services validate their sessions against this service's `auth`/`sessions` tables via [lib](../lib).

The API covers login/logout and session verification, the first-admin bootstrap and admin recovery (`/authorization/setup`), admin-only user and session management (create/list/update/delete users, list and revoke sessions), theme, and password changes. It also lists cameras (RTSP credentials stripped) for the web app.

`setup_TOKEN` is required — the service won't boot without it ([`server.js`](server.js)) — so a reachable `/setup` always demands the token. A valid token bootstraps the first admin (when the `auth` table is empty) or resets an existing admin (recovery). `/setup` is public but rate-limited.

---
# Web app

- Serves the compiled SPA (`dist/`, built from `frontend/`) as static files at `/`, `/login`, and every app path below.
- `/res` serves static assets (logo).
- Rendering and navigation are client-side React (`frontend/App.jsx`): dynamic `/:route` segment plus dedicated `/` and `/login`.
- Unauthenticated visitors are redirected to `/login`.

Sections (defined in `frontend/app/SideMenu.jsx`, mapped to paths by `frontend/js/routeIndexMapping.js`): Home, Live, Clip Maker, Recordings, Stats, Schedule, Objects, and an admin-only Admin section (hidden unless your role is `admin`). Mobile nav shows a subset (Clip, Live, Home, Recordings, Stats); desktop shows all.

---
# Config

`command_ON`, `command_PORT`, `command_HOST`, `command_PROXY_ON`, `SECRETKEY`, `setup_TOKEN`; see [../env.example](../env.example).
