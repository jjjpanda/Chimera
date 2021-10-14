var express    = require('express')
var {
    createProxyMiddleware
}              = require('http-proxy-middleware')

var app = express.Router();

const services = require('./lib/services.js')

for(const apiService of services){

    const {serviceOn, log, postPathRegex, getPathRegex, baseURL} = apiService

    if(serviceOn){
        console.log(log)
        app.use(new RegExp(postPathRegex.source + "|" + getPathRegex.source), createProxyMiddleware((pathname, req) => {
            return (pathname.match(postPathRegex) && req.method === 'POST') || (pathname.match(getPathRegex) && req.method === "GET");
        }, {
            target: baseURL,
            logLevel: "silent",
        }))
    }

}

module.exports = app