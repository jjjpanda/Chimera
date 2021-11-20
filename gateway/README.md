# Gateway <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The gateway is an API gateway for all servers that need to be exposed by one domain.

[services.js](services.js) has all of the API details necessary for the gateway.

```
module.exports = [...,
    {
        serviceOn: true //a boolean for whether a service is meant to be proxied,
        log: "I'm proxied!" //a string to print when said service is proxied,
        baseURL: https://microservice.bruh //base URL domain for the service,
        postPathRegex: /\/.*/ //a regex of which POST routes to proxy,
        getPathRegex: /\/.*/ //a regex of which GET routes to proxy 
    }
...]
```
