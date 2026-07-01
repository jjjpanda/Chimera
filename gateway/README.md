# Gateway <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Reverse proxy and single public entrypoint; matches each request by method + path (`services.js`) and forwards it to that service's `<prefix>_HOST`.

---
# Proxied services

[services.js](services.js) is the routing table. An entry is proxied only when its `<prefix>_PROXY_ON` is `true`.

|Service|Enable flag|Target|Methods proxied|
| :-|:- |:- |:- |
|[storage](../storage)|`storage_PROXY_ON`|`storage_HOST`|GET, POST, DELETE|
|[schedule](../schedule)|`schedule_PROXY_ON`|`schedule_HOST`|GET, POST|
|[livestream](../livestream)|`livestream_PROXY_ON`|`livestream_HOST`|GET, POST|
|[object](../object)|`object_PROXY_ON`|`object_HOST`|GET, POST|
|[command](../command)|`command_PROXY_ON`|`command_HOST`|GET, POST, PUT, PATCH, DELETE|

- Each entry declares per-method, start-anchored path regexes. `postPathRegex` and `getPathRegex` required; `deletePathRegex`/`putPathRegex`/`patchPathRegex` optional.
- A request is proxied only when both its method and path match; unmatched requests are not forwarded.
- Forwarded with `X-Forwarded-*` headers (`xfwd`) so downstream sees the original client.
- The gateway does no auth; each service enforces its own after the proxy hop.

---
# Ports & TLS

`gateway_ON=true` runs [server.js](server.js)'s Express app on two listeners:

- `gateway_PORT` — HTTP, via [lib](../lib) `handleServerStart`.
- `gateway_PORT_SECURE` — public HTTPS, via [lib](../lib) `handleSecureServerStart`, reading the TLS key/cert from `privateKey_FILEPATH` and `certificate_FILEPATH`. If either file is missing or unreadable the secure listener stays down and logs `🗺️🔒 Secure Gateway Off ❌`.

`gateway_HTTPS_Redirect=true` redirects any non-secure request (except `/.well-known/`) to `https://<host><url>`.

---
# ACME challenges

Before any proxying, the gateway statically serves `/.well-known/` from the repo-root `.well-known/` directory (dotfiles allowed), so HTTP-01 challenges are answered directly and exempt from the HTTPS redirect. `entrypoint.sh` creates `./.well-known/acme-challenge` on boot.

## ▶ /.well-known

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/acme-challenge/:token|Serves the ACME HTTP-01 challenge file|`token` (file name)|Challenge file contents|

---
# Runtime

- Root [server.js](../server.js) calls `gateway.start()` last (after `command`, `storage`, `livestream`, `schedule`, `object`, and the `memory` socket), unconditionally; the `gateway_ON` check inside the gateway's [server.js](server.js) decides whether to listen. Same Node process under pm2.
- `helmet` headers ([lib](../lib) `helmetOptions`) apply to every response except statically-served `/.well-known/` files (helmet is registered after that static middleware).

---
# Config

- `<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_ON`, `gateway_PORT`, `gateway_PORT_SECURE`, `privateKey_FILEPATH`, `certificate_FILEPATH`, `gateway_HTTPS_Redirect`; see [../env.example](../env.example) (Gateway section).
