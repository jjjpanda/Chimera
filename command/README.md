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

`setup_TOKEN` is required — the service won't boot without it ([server.js](server.js)). A valid token bootstraps the first admin only when no admin exists; it cannot reset or take over an existing account. `/setup` is public but rate-limited.

---
# Web app

- Serves the compiled SPA (`dist/`, built from `frontend/`) at `/`, `/login`, and every app path; `/res` serves static assets.
- Client-side React ([frontend/App.jsx](frontend/App.jsx)); unauthenticated visitors redirect to `/login`.
- Sections: Home, Live, Clip Maker, Recordings, Stats, Schedule, Objects, and an admin-only Admin (hidden unless role is `admin`). Mobile shows a subset.

---
# Config

`command_ON`, `command_PORT`, `command_HOST`, `command_PROXY_ON`, `command_COOKIE_SECURE`, `SECRETKEY`, `setup_TOKEN`; see [../env.example](../env.example).

`command_COOKIE_SECURE` sets the `Secure` flag on the auth cookie. It is config, not `req.secure`: `trust proxy` makes Express read `X-Forwarded-Proto`, which a client can prepend to, and the gateway's `xfwd` appends rather than overwrites — so the request cannot be trusted to describe its own transport. Which value to pick: [env.example](../env.example).

---
# Login limits

Four controls run on `POST /authorization/login`, in order:

- **Per IP, burst** — 20 tries per 15 minutes, then the throttle below. `req.ip` comes from the last `X-Forwarded-For` entry, which the gateway appends, so a forged header cannot raise the limit. This holds only while the gateway is the sole reachable port. The budget absorbs a shared address fumbling several logins at once without funding a wide spray — 20 tries is at most two usernames' budgets, not ten. A device token does **not** skip this one, so it stays the brake on a stolen token.
- **Per IP, daily** — 100 tries per 24 hours, then one check per 15 minutes. This is the ceiling on what one address can spend in a day: without it, the burst throttle alone would still admit ~17,000 checks per day per address. Only attempts that clear the burst budget spend it, so a flood of throttled 429s does not drain a shared address's day. A device token does not skip this one either.
- **Per username** — 10 tries per 15 minutes. A success refunds its slot, and so does a 5xx; only a rejected password spends one. Once the budget is spent, nothing refunds it — a correct password gets the user in, but the throttle below stays on for the rest of the window.
- **Throttle** — once a budget is spent, one credential check per window for that key: `THROTTLE_WINDOW_MS` (10s) for the burst and per-username budgets, 15 minutes for the daily one. Extra requests get 429 straight away. Nothing is queued, so a flood cannot build latency or hold sockets open. The check that does run answers 429 too when the password is wrong, so a 429 does not prove the credentials went unchecked. Only a correct password gets through, with 200.

No budget ends in a hard block. Clients sharing an egress IP (a home router, carrier CGNAT) share the per-IP budgets, which is why they throttle rather than 429. While an attack on that address is running they contend for the one slot, and can keep losing it.

The per-IP budgets are also a capacity choice. `bcryptjs` yields only when a slice runs past 100ms, and a cost-10 check takes ~50ms, so it holds the event loop for its whole duration — longer on a Pi or NAS:

| concurrent logins from one IP | every route stalls for |
|---|---|
| 10 | ~0.5s |
| 20 (the burst budget) | ~1s |

Nothing caps this across addresses, and a spray of distinct usernames gets a fresh per-username budget each, so N addresses buy N×20 checks per window and about N×200 per day. Run a cluster (`chimeraInstances`) to spread that across workers; it also forces `memory_ON=true`, which keeps these limits shared.

A successful login also sets `devicetoken`, a year-long signed cookie naming that username. A login carrying a valid one skips the per-username budget, so an attacker cannot lock a user out of a device they have already used. Only the per-IP limits stay, which give 20 tries per 15 minutes **per address**, 100 per day, and a trickle after that — so a token replayed from many addresses gets that from each, with no per-username limit at all. The cookie is `httpOnly` and signed, so a script cannot read it; theft needs access to the device or its browser profile.

The cookie also carries `dk`, a SHA-256 digest of the password hash it was issued against, and `knownDevice` re-reads that hash on every login. Any password change — a user reset, an admin reset, or deleting and recreating the account — changes the digest and voids every device token for that username, which restores the per-username cap. This is the remediation path after a device is stolen. Revoking sessions alone does not void the cookie; reset the password.

The limits are tuned to keep legitimate users in, not to guarantee an attacker is stopped. Three consequences follow:

- Under an active attack, a client with no `devicetoken` is slowed to one attempt per 10s and competes with the attacker for that slot. On a shared egress IP this applies even when the attack targets someone else, since the per-IP budgets are common to that address — and once the address's daily budget is spent, the slot opens only every 15 minutes.
- `knownDevice` matches the username and current password hash, not a live session. On a shared browser, a later user inherits the skip for the username that logged in before them.
- A stolen `devicetoken` faces the per-IP limits but no per-username one, so it gets at most ~200 guesses per address per day. Reset the password to void it.

Logout keeps the cookie on purpose — it exists to survive session expiry.
