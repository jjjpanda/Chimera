var express    = require("express")
const path = require("path")
const helmet = require("helmet")
var {
	createProxyMiddleware
}              = require("http-proxy-middleware")
const { handleServerStart, handleSecureServerStart, helmetOptions } = require("lib")

var app = express()

let logs = []

app.use(helmet(helmetOptions))

if(process.env.gateway_HTTPS_Redirect == "true"){
	app.use((req, res, next) => {
		if(req.secure || req.path.split("/")[1] == ".well-known"){
			next()
		}
		else{
			res.redirect(`https://${req.headers.host}${req.url}`)
		}
	})
}

const services = require("./services.js")
for(const apiService of services){
	const {serviceOn, log, postPathRegex, getPathRegex, baseURL} = apiService

	if(serviceOn){
		logs.push(log)
		app.use(new RegExp(postPathRegex.source + "|" + getPathRegex.source), createProxyMiddleware((pathname, req) => {
			return (pathname.match(postPathRegex) && req.method === "POST") || (pathname.match(getPathRegex) && req.method === "GET")
		}, {
			target: baseURL,
			logLevel: "silent",
		}))
	}
}

app.use("/.well-known/acme-challenge/", express.static(path.join(__dirname, "./.well-known/acme-challenge"), {
	dotfiles: "allow"
}))

module.exports = () => {
	const successCallback = () => {
		console.log(`🗺️ Gateway On ▶ PORT ${process.env.gateway_PORT}`)
		for(const log of logs){
			console.log(log)
		}
	}
	const failureCallback = (err) => {
		if(err != undefined){
			console.log(err)
		}
		console.log("🗺️ Gateway Off ❌")
	}

	const successCallbackSecure = () => {
		console.log(`🗺️🔒 Secure Gateway On ▶ PORT ${process.env.gateway_PORT_SECURE}`)
	}
	const failureCallbackSecure = () => {
		console.log("🗺️🔒 Secure Gateway Off ❌")
	}

	handleServerStart(app, process.env.gateway_PORT, successCallback, failureCallback)
	handleSecureServerStart(app, process.env.gateway_PORT_SECURE, successCallbackSecure, failureCallbackSecure)
}