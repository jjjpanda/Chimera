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

Forwarded with `X-Forwarded-*` (`xfwd`). Any `Authorization` header on the incoming request is dropped before forwarding. The gateway does no auth of its own — each service enforces its own after the proxy hop.

If you run your own proxy in front of Chimera (nginx, Caddy, a load balancer), drop `Authorization` there too. Passing it through from public traffic lets an outsider act as the scheduler.

---
# Ports & TLS

The gateway runs two listeners:
- `gateway_PORT` — HTTP.
- `gateway_PORT_SECURE` — HTTPS, key/cert auto-resolved from `gateway_HOST` under `/etc/letsencrypt/live/` (override with `privateKey_FILEPATH` / `certificate_FILEPATH` — both or neither); if either is unreadable the secure listener stays down.

`gateway_HTTPS_Redirect=true` redirects non-secure requests (except `/.well-known/`) to HTTPS. It reads `req.secure` — by default the gateway's own TLS socket, which cannot be spoofed.

The redirect target is built once at boot from `gateway_HOST` + `gateway_PORT_SECURE`, not from the request's `Host`, so the deploy is single-name: a browser opening `http://192.168.1.50/…`, a tailnet name, or a container alias is sent to `gateway_HOST`, which internal DNS or hairpin NAT has to resolve. Give `gateway_HOST` a port only if it matches `gateway_PORT_SECURE` — a disagreement sends browsers to a port with no TLS listener, which `npm run preflight` warns about without blocking. If `gateway_HOST` is unset or unparseable the target falls back to the request's own `Host` header, so a forged `Host` picks where visitors land.

`gateway_TRUST_PROXY=true` enables `trust proxy`, so `req.secure` reads `X-Forwarded-Proto` instead. Set it only when something in front terminates TLS (nginx, a CDN, a tunnel); the redirect loops without it. It stays opt-in because anyone who can reach `gateway_PORT` directly can forge that header and skip the redirect.

---
# ACME challenges

Before proxying, serves `/.well-known/` from the repo-root dir (dotfiles allowed) so HTTP-01 challenge files are answered directly and skip the HTTPS redirect. `entrypoint.sh` creates the dir on boot. `helmet` ([lib](../lib) `helmetOptions`) applies to every response except these static files.

---
# Config

`<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_PORT`, `gateway_PORT_SECURE`, `gateway_HOST` (TLS cert derive, HTTPS redirect target), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS override), `gateway_HTTPS_Redirect`, `gateway_TRUST_PROXY`; see [../env.example](../env.example).
