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

### Why `Authorization` is stripped

Services trust the scheduler token (`scheduler_AUTH`) only from addresses in `scheduler_TRUSTED_SOURCES`, which defaults to loopback. The gateway calls services over loopback, so everything it forwards looks trusted to them.

Stripping the header is therefore what stops a stolen token from arriving in a request off the internet and being honoured.

The same applies to anything you put in front of Chimera or its services — nginx, Caddy, a cloud load balancer. If it forwards `Authorization` from public traffic, it hands attackers the token bypass. Strip it there too.

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
