# Command <img src="frontend/res/logo.png" alt="logo" width="20"/> 

Serves the web app and handles authentication, RBAC, and session management.

---
# API

Three access levels: public, session (`authorize`), admin (`requireAdmin`). Auth/RBAC/sessions live here; other services validate against this service's `auth`/`sessions` tables via [lib](../lib).

- login/logout, session verification
- first-admin bootstrap + admin recovery (`/authorization/setup`)
- admin-only user and session management (create/list/update/delete users; list/revoke sessions)
- theme and password changes
- list cameras (RTSP credentials stripped) for the web app

`setup_TOKEN` is required — the service won't boot without it ([server.js](server.js)). A valid token bootstraps the first admin only when none exists; it cannot take over an existing account. `/setup` is public but rate-limited.

---
# Web app

- Serves the compiled SPA (`dist/`, built from `frontend/`) at `/`, `/login`, and every app path; `/res` serves static assets.
- Client-side React ([frontend/App.jsx](frontend/App.jsx)); unauthenticated visitors redirect to `/login`.
- Sections: Home, Live, Clip Maker, Recordings, Stats, Schedule, Objects, and an admin-only Admin (hidden unless role is `admin`). Mobile shows a subset.

---
# Config

`command_ON`, `command_PORT`, `command_HOST`, `command_PROXY_ON`, `command_COOKIE_SECURE`, `SECRETKEY`, `setup_TOKEN`; see [../env.example](../env.example).

`command_COOKIE_SECURE` sets the `Secure` flag on the auth cookie. It is a config value, not `req.secure`. With `trust proxy`, `req.secure` reads `X-Forwarded-Proto`, and a client can add a value at the start of that header. A request therefore cannot be trusted to describe its own transport. To pick a value: [env.example](../env.example).

---
# Login limits

`POST /authorization/login` counts against three limits in order, then it checks the password. [authorization.js](backend/routes/authorization.js) holds the allowances, the windows, and the throttle intervals.

| limit | counted per | a device token skips it |
|---|---|---|
| burst | IP address | no |
| daily | IP address | yes |
| account | username | yes |

No limit ends in a hard block. Once a limit is used up, the route runs one password check per window and answers 429 to every other request at once. Nothing waits in a queue, so a flood cannot build latency. That one check also answers 429 when the password is wrong, so a 429 does not prove the password went unchecked.

| response | the slot is |
|---|---|
| below 400 | refunded |
| 4xx | used |
| 5xx | refunded |

A request that the burst limit stops never reaches the daily limit. A flood of 429s therefore cannot use up the day of a shared address.

## Which address the limits count

The gateway replaces `X-Forwarded-For` with one value of its own, so a client cannot fake the address that `req.ip` returns. This holds only while the gateway is the one port outsiders can reach. A published `command_PORT`, or a `command_HOST` on another machine, lets anyone write that header and choose their own key. Which address the gateway writes: [gateway](../gateway#headers).

## Device tokens

A successful login sets `devicetoken`. It is a signed `httpOnly` cookie, it lasts one year, and it names the username. It skips the limits marked above, so the failures of other people cannot lock a user out of a device they already use. The burst limit still applies, so a stolen token is still capped.

The cookie also carries `dk`, a SHA-256 digest of the password hash it was issued against. `knownDevice` re-checks `dk` at every login. A password change therefore voids every token for that username. This is how you recover from a stolen device: if you only revoke the sessions, the cookie stays valid. Logout keeps the cookie on purpose, because the cookie has to survive the end of a session.

## What these limits do not do

These limits are tuned to keep real users in. They do not guarantee that an attacker is stopped. The costs:

| the limit | what it costs you |
|---|---|
| `gateway_TRUST_PROXY` is not `true` | every visitor behind a front proxy (CDN, nginx, tunnel) counts as one address, so the whole site shares one set of per-IP limits |
| the account limit throttles to one check per 10 seconds, not one per window | an attacker who changes address still gets about 8,600 guesses a day at one username. A longer throttle would instead let the attacker hold a user with no device token out of their own account. |
| clients share one exit address (home router, CGNAT) | they share the per-IP limits and compete for the single throttle slot, even when the attack targets somebody else |
| a key has one throttle slot, and any request takes it | a user with no device token waits out the window that an attacker holds |
| `knownDevice` matches the username and the current password hash, not a live session | on a shared browser, a later user inherits the skip |
| nothing caps attempts across addresses | run a cluster (`chimeraInstances`) to spread the load. A cluster also forces `memory_ON=true`, which keeps the limits shared. |
| `bcryptjs` holds the event loop for a whole cost-10 check | many logins at once from one address stall every route |
