# Gateway <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The gateway is the single public entrypoint for the system: a reverse proxy that forwards each incoming request to the microservice that owns its path. "Proxied" means a request hitting the gateway's domain is matched by method + path and transparently forwarded to that service's `<prefix>_HOST`, so the whole system is reachable through one domain.

---
# Proxied services

[services.js](services.js) is the routing table. Each entry is proxied only when its `<prefix>_PROXY_ON` flag is `true`, and matching requests are forwarded to that service's `<prefix>_HOST`.

|Service|Enable flag|Target|Methods proxied|
| :-|:- |:- |:- |
|[storage](../storage)|`storage_PROXY_ON`|`storage_HOST`|GET, POST, DELETE|
|[schedule](../schedule)|`schedule_PROXY_ON`|`schedule_HOST`|GET, POST|
|[livestream](../livestream)|`livestream_PROXY_ON`|`livestream_HOST`|GET, POST|
|[object](../object)|`object_PROXY_ON`|`object_HOST`|GET, POST|
|[command](../command)|`command_PROXY_ON`|`command_HOST`|GET, POST, PUT, PATCH, DELETE|

Each entry declares a per-method path regex; `postPathRegex` and `getPathRegex` are required, and `deletePathRegex` / `putPathRegex` / `patchPathRegex` are optional. A request is proxied only when both its method **and** its path match the corresponding (start-anchored) regex — anything unmatched is not forwarded.

```js
module.exports = [..., {
	serviceOn: process.env.storage_PROXY_ON === "true",  // proxy this entry only when its <prefix>_PROXY_ON is "true"
	log: "📂 Storage Proxied ◀",                          // printed on boot when the service is proxied
	baseURL: process.env.storage_HOST,                   // <prefix>_HOST the matching requests are forwarded to
	postPathRegex: /\/convert\/.../,                      // POST paths to proxy (required)
	getPathRegex: /\/shared\/.../,                        // GET paths to proxy (required)
	deletePathRegex: /\/camera\/\d+/                      // DELETE paths (optional; putPathRegex/patchPathRegex also supported)
}, ...]
```

Proxied requests are forwarded with `X-Forwarded-*` headers (`xfwd`) so downstream services see the original client; the gateway itself performs no auth — each service enforces its own after the proxy hop.

---
# Ports & TLS

When `gateway_ON=true`, the gateway's [server.js](server.js) runs the same Express app on two listeners:

- `gateway_PORT` — HTTP, via [lib](../lib) `handleServerStart`.
- `gateway_PORT_SECURE` — HTTPS, via [lib](../lib) `handleSecureServerStart`, reading the TLS key/cert from `privateKey_FILEPATH` and `certificate_FILEPATH`. This is the public HTTPS port; if either file is missing or unreadable the secure listener stays down and logs `🗺️🔒 Secure Gateway Off ❌`.

When `gateway_HTTPS_Redirect=true`, any request that is not already secure (and is not a `/.well-known/` request) is redirected to `https://<host><url>`.

---
# ACME challenges

Before any proxying, the gateway statically serves `/.well-known/` from the repo-root `.well-known/` directory (dotfiles allowed), so HTTP-01 ACME challenges are answered directly and are exempt from the HTTPS redirect. `entrypoint.sh` creates `./.well-known/acme-challenge` on boot.

## ▶ /.well-known

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/acme-challenge/:token|Serves the ACME HTTP-01 challenge file from `.well-known/acme-challenge/`|`token` (file name)|Challenge file contents|

---
# How it fits

- The root [server.js](../server.js) calls `gateway.start()` last (after `command`, `storage`, `livestream`, `schedule`, `object`, and the `memory` socket); that call is unconditional, and the `gateway_ON` check lives inside the gateway's [server.js](server.js), which decides whether to actually listen. It runs in the same Node process under pm2.
- `helmet` security headers ([lib](../lib) `helmetOptions`) are applied to every response except statically-served `/.well-known/` files, since helmet is registered after that static middleware.
- Config keys live in [../env.example](../env.example) under the Gateway section: the `<prefix>_PROXY_ON` toggles, the per-service `<prefix>_HOST` targets, `gateway_ON`, `gateway_PORT`, `gateway_PORT_SECURE`, `privateKey_FILEPATH`, `certificate_FILEPATH`, and `gateway_HTTPS_Redirect`.
