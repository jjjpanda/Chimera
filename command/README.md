# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

Serves the web app and handles authentication, RBAC, and session management.

---
# Routes
## ▶ /authorization

`auth` = session (`authorize`); `admin` = session + admin (`requireAdmin`); `none` = public.

|Type|Route|Auth|Description|Body|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/status|none|Setup state and whether a token is required|—|`{setup, tokenRequired}`|
|POST|/setup|token*|Bootstrap first admin or recover admin (rate-limited)|`{username, password, token?}`|`{error}`|
|POST|/login|none|Authenticate, set `bearertoken` cookie (rate-limited)|`{username, password}`|`{error, ...}` + cookie|
|POST|/verify|auth|Validate session|—|`{role, theme, forcePasswordChange}`|
|PUT|/theme|auth|Save theme (`light`/`dark`/`system`)|`{theme}`|`{error}`|
|GET|/users|admin|List users|—|`[{username, role, last_login}]`|
|POST|/users|admin|Create user with temp password|`{username, role}`|`{tempPassword}`|
|PATCH|/users/:username|admin|Update role/password (can't demote last admin)|`{role?, password?}`|`{error}`|
|DELETE|/users/:username|admin|Delete user (not self, not last admin)|—|`{error}`|
|GET|/users/:username/sessions|admin|List user's sessions|—|`[{id, issued_at, last_seen, ip, user_agent, revoked}]`|
|DELETE|/sessions/:id|admin|Revoke a session|—|`{error}`|
|POST|/password|auth|Change own password|`{password}`|`{error}`|
|POST|/logout|auth|Revoke session, clear cookie|—|`{error}`|

\* `/setup` is public but rate-limited. `setup_TOKEN` is required; the service won't boot without it (`command/server.js`), so a reachable `/setup` always demands the token. A valid token bootstraps the first admin (when the `auth` table is empty) or resets an existing admin (recovery).

## ▶ /cameras

Behind `authorize`; session required.

|Type|Route|Auth|Description|Body|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/|auth|List cameras (RTSP creds stripped)|—|`[{id, name, rtsp_url}]`|

## ▶ /command

|Type|Route|Auth|Description|Parameters|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/health|none|Server alive|N/A|N/A|

---
# Web app

- Serves the compiled SPA (`dist/`, built from `frontend/`) as static files at `/`, `/login`, and every app path below.
- `/res` serves static assets (logo).
- Rendering and navigation are client-side React (`frontend/App.jsx`): dynamic `/:route` segment plus dedicated `/` and `/login`.
- Unauthenticated visitors are redirected to `/login`.

Sections defined in `frontend/app/SideMenu.jsx`, mapped to paths by `frontend/js/routeIndexMapping.js`:

|Section|Path|Notes|
| :-|:- |:- |
|Home|/||
|Live|/live||
|Clip Maker|/clip||
|Recordings|/recordings||
|Stats|/stats||
|Schedule|/schedule||
|Objects|/objects||
|Admin|/admin|Admin only; hidden unless role is `admin` (RBAC-gated)|

Mobile nav shows a subset (Clip, Live, Home, Recordings, Stats); desktop shows all.

---
# Config

`command_ON`, `command_PORT`, `command_HOST`, `command_PROXY_ON`, `SECRETKEY`, `setup_TOKEN`; see [../env.example](../env.example).
