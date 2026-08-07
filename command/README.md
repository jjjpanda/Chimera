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

`command_COOKIE_SECURE` sets the `Secure` flag on the auth cookie. It is config, not `req.secure`: `trust proxy` reads `X-Forwarded-Proto`, which a client can prepend to and the gateway's `xfwd` appends to rather than overwrites — so the request cannot be trusted to describe its own transport. Which value to pick: [env.example](../env.example).

---
# Login limits

`POST /authorization/login` spends three budgets in order, then checks the password:

| budget | key | allowance | once spent |
|---|---|---|---|
| burst | IP | 20 / 15 min | 1 check / 10s |
| daily | IP | 100 / 24h | 1 check / 15 min |
| account | username | 10 / 15 min | 1 check / 10s |

No budget ends in a hard block. A spent budget throttles to one credential check per window; extra requests get 429 immediately and nothing queues, so a flood cannot build latency. That one check also answers 429 on a wrong password — a 429 does not prove the credentials went unchecked.

A response under 400, or a 5xx, refunds the slot; every 4xx spends it. So a request the account throttle rejects spends both IP slots without checking a password. A request stopped at the burst stage never reaches the daily budget, which keeps a flood of 429s from draining a shared address's day.

The daily budget caps one address: without it, the burst throttle alone would admit ~10,560 checks a day.

`req.ip` is the last `X-Forwarded-For` entry, which the gateway appends as its own peer, so a forged header cannot raise the limit.

## Device tokens

A successful login sets `devicetoken`, a year-long signed `httpOnly` cookie naming the username. It skips the **account** and **daily** budgets, so no one else's failures can lock a user out of a device they already use. The daily budget matters here because one address covers a whole site and stays spent until tomorrow. The burst budget still applies, capping a stolen token at 20 guesses per 15 minutes, then one per 10s.

The cookie also carries `dk`, a SHA-256 digest of the password hash it was issued against, which `knownDevice` re-checks on every login. A password change therefore voids every token for that username and restores both the account and daily caps — the remediation path for a stolen device, since revoking sessions alone does not void the cookie. Logout keeps it on purpose; it exists to survive session expiry.

## What this does not do

These budgets are tuned to keep legitimate users in, not to guarantee an attacker is stopped. The consequences:

- Any proxy in front of the gateway (CDN, nginx, tunnel) becomes that peer, so the whole site shares one set of per-IP budgets.
- Clients behind one egress IP (home router, CGNAT) share the per-IP budgets and contend for the single slot, even when the attack targets someone else.
- `knownDevice` matches username and current password hash, not a live session, so a shared browser lets a later user inherit the skip.
- Nothing caps attempts across addresses: N addresses buy N×20 checks per window, ~N×200 per day. Run a cluster (`chimeraInstances`) to spread the load; it also forces `memory_ON=true`, which keeps the budgets shared.
- `bcryptjs` holds the event loop for a whole cost-10 check (~50ms, longer on a Pi or NAS), so 20 concurrent logins from one address stall every route for ~1s.
