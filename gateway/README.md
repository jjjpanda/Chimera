# Gateway <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Reverse proxy and single public entrypoint; matches each request by method + path ([services.js](services.js)) and forwards it to that service's `<prefix>_HOST`.

---
# Proxied services

Proxied only when `<prefix>_PROXY_ON=true`, and only when both method and path match its start-anchored regexes ([services.js](services.js)):

- [storage](../storage) — GET, POST, DELETE
- [schedule](../schedule) — GET, POST
- [livestream](../livestream) — GET, POST
- [object](../object) — GET, POST
- [command](../command) — GET, POST, PUT, PATCH, DELETE

The gateway writes `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` from scratch instead of appending to what the client sent, so a backend on `trust proxy 1` sees exactly one entry and no client can add one in front of it. `gateway_TRUST_PROXY` sets what that entry holds: `false`, the address the gateway sees, which is your front proxy if you run one; `true`, the client address that proxy reports.

The gateway deletes any `Authorization` header before forwarding. It does no auth itself; each service checks its own.

If you run your own proxy in front of Chimera (nginx, Caddy, a load balancer), drop `Authorization` there too. Passing it through from public traffic lets an outsider act as the scheduler.

---
# Ports & TLS

The gateway runs two listeners:
- `gateway_PORT` — HTTP.
- `gateway_PORT_SECURE` — HTTPS, key/cert auto-resolved from `gateway_HOST` under `/etc/letsencrypt/live/` (override with `privateKey_FILEPATH` / `certificate_FILEPATH` — both or neither); if either is unreadable the secure listener stays down.

`gateway_HTTPS_Redirect=true` redirects non-secure requests (except `/.well-known/`) to HTTPS. By default it reads the gateway's own TLS socket, which cannot be spoofed.

Everyone lands on `gateway_HOST` and `gateway_PORT_SECURE`, whatever address they typed — so pick a name every visitor can resolve, and don't put a port on it unless it is `gateway_PORT_SECURE`. With no usable `gateway_HOST` the redirect fails closed with a 500 rather than following the browser's own `Host` header, which anyone can forge.

`gateway_TRUST_PROXY=true` turns on Express `trust proxy`. The redirect then also counts a request as secure if `X-Forwarded-Proto` says `https`. It reads the **last** value in that header: each proxy appends, so the last one comes from the proxy in front, while anything a client writes lands first and is ignored. Express's `req.secure` reads the first value, which is why the code does not use it.

Set the flag only when something in front terminates TLS (nginx, a CDN, a tunnel), and keep `gateway_PORT` closed to everything but that proxy. Without the flag the redirect loops; with it, anyone who reaches `gateway_PORT` directly can fake the header and skip the redirect.

---
# ACME challenges

Before proxying, serves `/.well-known/` from the repo-root dir (dotfiles allowed) so HTTP-01 challenge files are answered directly and skip the HTTPS redirect. `entrypoint.sh` creates the dir on boot. `helmet` ([lib](../lib) `helmetOptions`) applies to every response except these static files.

---
# Config

`<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_PORT`, `gateway_PORT_SECURE`, `gateway_HOST` (TLS cert derive, HTTPS redirect target), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS override), `gateway_HTTPS_Redirect`, `gateway_TRUST_PROXY`; see [../env.example](../env.example).
