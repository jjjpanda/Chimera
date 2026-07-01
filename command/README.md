# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

The command server is the face of the operation. It serves the web app and handles authentication, RBAC, and session management for the whole system.

---
# Routes
## ▶ /authorization

`auth` = valid session required (`authorize`). `admin` = valid session **and** admin role (`authorize` + `requireAdmin`). `none` = public.

|Type|Route|Auth|Description|Body|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/status|none|Whether setup has been completed and if a setup token is required|—|`{setup, tokenRequired}`|
|POST|/setup|token*|Bootstrap the first admin, or recover the admin account (rate-limited)|`{username, password, token?}`|`{error}`|
|POST|/login|none|Authenticate and set the `bearertoken` cookie (rate-limited)|`{username, password}`|`{error, ...}` + cookie|
|POST|/verify|auth|Validate the current session|—|`{role, theme, forcePasswordChange}`|
|PUT|/theme|auth|Save the user's theme preference (`light`/`dark`/`system`)|`{theme}`|`{error}`|
|GET|/users|admin|List all users|—|`[{username, role, last_login}]`|
|POST|/users|admin|Create a user with a temporary password|`{username, role}`|`{tempPassword}`|
|PATCH|/users/:username|admin|Update a user's role and/or password (can't demote the last admin)|`{role?, password?}`|`{error}`|
|DELETE|/users/:username|admin|Delete a user (not yourself, not the last admin)|—|`{error}`|
|GET|/users/:username/sessions|admin|List a user's sessions|—|`[{id, issued_at, last_seen, ip, user_agent, revoked}]`|
|DELETE|/sessions/:id|admin|Revoke a session|—|`{error}`|
|POST|/password|auth|Change your own password|`{password}`|`{error}`|
|POST|/logout|auth|Revoke the current session and clear the cookie|—|`{error}`|

\* `/setup` is public but rate-limited. When `setup_TOKEN` is configured it must be supplied, and the call can bootstrap the first admin (when none exists) or reset an existing admin account (recovery). When `setup_TOKEN` is not configured it only bootstraps the very first admin — i.e. it succeeds only while the `auth` table is empty.

## ▶ /cameras

Mounted behind `authorize`, so a valid session is required.

|Type|Route|Auth|Description|Body|Returns|
| :-|:- |:-:|:-|:-:|:-:|
|GET|/|auth|List configured cameras (RTSP credentials stripped)|—|`[{id, name, rtsp_url}]`|

## ▶ /command

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|

---
# Web app

The backend serves the compiled single-page app (`dist/`, built from `frontend/`) as static files at `/`, `/login`, and every app path (`/clip`, `/live`, `/recordings`, `/stats`, `/schedule`, `/admin`, `/objects`); `/res` serves static assets such as the logo. All rendering and navigation happen client-side in React (`frontend/App.jsx`), which matches the app sections via a dynamic `/:route` segment alongside dedicated `/` and `/login` routes; unauthenticated visitors are redirected to `/login`.

The app is organized into sections defined in `frontend/app/SideMenu.jsx` and mapped to paths by `frontend/js/routeIndexMapping.js`:

|Section|Path|Notes|
| :-|:- |:- |
|Home|/||
|Live|/live||
|Clip Maker|/clip||
|Recordings|/recordings||
|Stats|/stats||
|Schedule|/schedule||
|Objects|/objects||
|Admin|/admin|Admin only — hidden unless the session role is `admin` (RBAC-gated)|

Mobile navigation surfaces a subset of these (Clip, Live, Home, Recordings, Stats); the full set is available on desktop.
