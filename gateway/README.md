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

Forwarded with `X-Forwarded-*` (`xfwd`), minus any inbound `Authorization` header. The gateway does no auth of its own — each service enforces its own after the proxy hop.

The `Authorization` strip is load-bearing, not hygiene. Services match `scheduler_TRUSTED_SOURCES` against the socket peer, and the gateway reaches each service over loopback, so anything it proxies already satisfies the default `loopback` trust. The strip is the only thing stopping a leaked `scheduler_AUTH` from riding in on a public request. **Any reverse proxy you put in front of a service must strip `Authorization` from public traffic for the same reason** — one that forwards it and dials the service over loopback re-exposes `scheduler_AUTH` to the internet.

---
# Ports & TLS

`gateway_ON=true` runs two listeners:
- `gateway_PORT` — HTTP.
- `gateway_PORT_SECURE` — HTTPS, key/cert auto-resolved from `gateway_HOST` under `/etc/letsencrypt/live/` (override with `privateKey_FILEPATH` / `certificate_FILEPATH` — both or neither); if either is unreadable the secure listener stays down.

`gateway_HTTPS_Redirect=true` redirects non-secure requests (except `/.well-known/`) to HTTPS. It reads `req.secure` off the gateway's own socket, so enable it only when the gateway terminates TLS itself — behind an upstream terminator that forwards plain HTTP it redirects every request in a loop.

---
# ACME challenges

Before proxying, serves `/.well-known/` from the repo-root dir (dotfiles allowed) so HTTP-01 challenge files are answered directly and skip the HTTPS redirect. `entrypoint.sh` creates the dir on boot. `helmet` ([lib](../lib) `helmetOptions`) applies to every response except these static files.

---
# Config

`<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_ON`, `gateway_PORT`, `gateway_PORT_SECURE`, `gateway_HOST` (TLS cert derive), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS override), `gateway_HTTPS_Redirect`; see [../env.example](../env.example).
