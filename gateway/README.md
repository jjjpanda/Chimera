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

`gateway_HTTPS_Redirect=true` redirects non-secure requests (except `/.well-known/`) to HTTPS. It reads `req.secure`. If the key/cert above resolve to files that exist, that reflects the gateway's own TLS socket, unspoofable. Otherwise `trust proxy` is enabled and `req.secure` comes from `X-Forwarded-Proto` — an upstream terminator works, but only if it sends that header and `gateway_PORT` is unreachable except from it; anyone else who can reach it can forge the header and skip the redirect.

---
# ACME challenges

Before proxying, serves `/.well-known/` from the repo-root dir (dotfiles allowed) so HTTP-01 challenge files are answered directly and skip the HTTPS redirect. `entrypoint.sh` creates the dir on boot. `helmet` ([lib](../lib) `helmetOptions`) applies to every response except these static files.

---
# Config

`<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_PORT`, `gateway_PORT_SECURE`, `gateway_HOST` (TLS cert derive), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS override), `gateway_HTTPS_Redirect`; see [../env.example](../env.example).
