# Gateway <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

Reverse proxy and the only public entry point. It matches each request by method and path ([services.js](services.js)), then sends the request to that service's `<prefix>_HOST`.

---
# Proxied services

The gateway forwards a request only when both of these are true:

1. `<prefix>_PROXY_ON=true`.
2. The method and the path match that service's start-anchored regexes ([services.js](services.js)).

| service | methods |
|---|---|
| [storage](../storage) | GET, POST, DELETE |
| [schedule](../schedule) | GET, POST |
| [livestream](../livestream) | GET, POST |
| [object](../object) | GET, POST |
| [command](../command) | GET, POST, PUT, PATCH, DELETE |

## Headers

The gateway writes `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` itself. It does not add to the values that arrived with the request. A backend on `trust proxy 1` therefore reads exactly one value, and no client can put a value in front of it.

`gateway_TRUST_PROXY` selects the address that goes in `X-Forwarded-For`:

| `gateway_TRUST_PROXY` | address the gateway writes |
|---|---|
| `false` | the address the gateway sees. This is your own proxy, if you run one in front. |
| `true` | the client address that your own proxy reports |
| a number | the address reported that many hops out, for a CDN in front of your own proxy |

The gateway deletes any `Authorization` header before it forwards the request. The gateway runs no authentication of its own. Each service runs its own after the proxy hop.

If you run your own proxy in front of Chimera (nginx, Caddy, a load balancer), delete `Authorization` there too. If you let it through from public traffic, an outsider can act as the scheduler.

---
# Ports & TLS

The gateway opens two listeners:

| listener | port | opens when |
|---|---|---|
| HTTP | `gateway_PORT` | always |
| HTTPS | `gateway_PORT_SECURE` (default 443) | the gateway can read both the key and the certificate |

Where the gateway looks for the pair:

```
privateKey_FILEPATH and certificate_FILEPATH set?
├─ yes → those two paths          (set both, or set neither)
└─ no  → /etc/letsencrypt/live/<gateway_HOST domain>/privkey.pem
                                                    /fullchain.pem
```

If the gateway cannot read either file, the HTTPS listener stays down.

## The HTTPS redirect

`gateway_HTTPS_Redirect=true` sends every non-secure request to HTTPS. Requests under `/.well-known/` are the exception.

Every visitor lands on `gateway_HOST` and `gateway_PORT_SECURE`, whatever address they typed. Two rules follow:

- Give `gateway_HOST` a name that every visitor can resolve.
- Put a port on `gateway_HOST` only when it is the same port as `gateway_PORT_SECURE`.

If `gateway_HOST` is not usable, the redirect answers 500. It does not fall back to the browser's own `Host` header, because anyone can forge that header.

## How the redirect decides a request is secure

| `gateway_TRUST_PROXY` | the gateway reads |
|---|---|
| `false` | its own TLS socket. Nobody can forge this. |
| `true` | its own TLS socket, or `X-Forwarded-Proto` |
| a number | the same, counting that many proxies |

The gateway counts back from the end of `X-Forwarded-Proto` by the number of trusted hops. Each proxy adds its value at the end, so with `true` — one hop — the gateway reads the last value, the one written by the proxy directly in front. A client can only add a value at the start, so the gateway ignores it. Express `req.secure` reads the first value, which a client can forge, and this is why the code does not use `req.secure`.

Set `gateway_TRUST_PROXY=2` when a CDN sits in front of your own proxy and that proxy adds to the header instead of replacing it. The header arrives as `https,http`: the CDN saw https, your proxy saw the plain hop to the gateway. With `1` the gateway reads `http` and redirects an https visit back to itself, which the CDN sends round again (`ERR_TOO_MANY_REDIRECTS`). Count the proxies between the visitor and the gateway.

Set `gateway_TRUST_PROXY` above `false` only when both of these are true:

1. Something in front of the gateway terminates TLS (nginx, a CDN, a tunnel).
2. Nothing but that proxy can reach `gateway_PORT`.

| you get | when |
|---|---|
| a redirect loop (`ERR_TOO_MANY_REDIRECTS`) | a proxy holds the certificate, and `gateway_TRUST_PROXY` is not `true` |
| a redirect that anyone can skip | `gateway_TRUST_PROXY=true`, and outsiders can reach `gateway_PORT` |

---
# ACME challenges

Before it proxies, the gateway serves `/.well-known/` from the repo-root dir, dotfiles included. HTTP-01 challenge files are therefore answered directly and skip the HTTPS redirect. `entrypoint.sh` creates the dir at boot. `helmet` ([lib](../lib) `helmetOptions`) applies to every response except these static files.

---
# Config

`<prefix>_PROXY_ON`, `<prefix>_HOST`, `gateway_PORT`, `gateway_PORT_SECURE`, `gateway_HOST` (TLS cert path, HTTPS redirect target), `privateKey_FILEPATH` / `certificate_FILEPATH` (TLS override), `gateway_HTTPS_Redirect`, `gateway_TRUST_PROXY`; see [../env.example](../env.example).
