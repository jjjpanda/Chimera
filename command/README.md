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

Three controls run on `POST /authorization/login`, in order:

- **Per IP** — 10 tries per 15 minutes. `req.ip` comes from the last `X-Forwarded-For` entry, which the gateway appends, so a forged header cannot raise the limit. This holds only while the gateway is the sole reachable port.
- **Per username** — 10 tries per 15 minutes. A success refunds its slot, and so does a 5xx; only a rejected password spends one. Once the budget is spent, nothing refunds it — a correct password gets the user in, but the throttle below stays on for the rest of the window.
- **Throttle** — once the per-username budget is spent, one credential check per `THROTTLE_WINDOW_MS` (10s). Extra requests get 429 straight away. Nothing is queued, so a flood cannot build latency or hold sockets open. The check that does run answers 429 too when the password is wrong, so a 429 does not prove the credentials went unchecked. Only a correct password gets through, with 200.

A successful login also sets `devicetoken`, a year-long signed cookie naming that username. A login carrying a valid one skips the per-username budget and the throttle, so an attacker cannot lock a user out of a device they have already used. Only the per-IP limit stays, which gives 10 tries per 15 minutes **per address** — so a token replayed from many addresses gets 10 tries from each, with no per-username limit at all. The cookie is `httpOnly` and signed, so a script cannot read it; theft needs access to the device or its browser profile.

The cookie also carries `dk`, a SHA-256 digest of the password hash it was issued against, and `knownDevice` re-reads that hash on every login. Any password change — a user reset, an admin reset, or deleting and recreating the account — changes the digest and voids every device token for that username, which restores the per-username cap. This is the remediation path after a device is stolen. Revoking sessions alone does not void the cookie; reset the password.

Two gaps stay open:

- A user on a device with no `devicetoken` can still be throttled while an attack is running.
- `knownDevice` matches the username and current password hash, not a live session. On a shared browser, a later user skips the per-username limits for the username that logged in before them.

Logout keeps the cookie on purpose — it exists to survive session expiry.
