var express    = require("express")
const path = require("path")
const helmet = require("helmet")
var {
	createProxyMiddleware
}              = require("http-proxy-middleware")
const { helmetOptions, gatewayHost } = require("lib")

var app = express()
const trustProxy = process.env.gateway_TRUST_PROXY == "true"
if(trustProxy){
	app.set("trust proxy", 1)
}

app.use("/.well-known/", express.static(path.join(__dirname, "../.well-known/"), {
	dotfiles: "allow"
}))

app.use(helmet(helmetOptions))

const forwardedProto = (req) => (req.headers["x-forwarded-proto"] || "").split(",").pop().trim().toLowerCase()
const isSecure = (req) => !!req.socket.encrypted || (trustProxy && forwardedProto(req) == "https")

if(process.env.gateway_HTTPS_Redirect == "true"){
	const securePort = process.env.gateway_PORT_SECURE || 443
	const portSuffix = trustProxy || String(securePort) == "443" ? "" : `:${securePort}`
	const redirectTarget = (() => {
		try{
			const url = new URL(gatewayHost())
			return url.protocol == "https:" && url.port ? url.host : `${url.hostname}${portSuffix}`
		}
		catch{
			return ""
		}
	})()
	app.use((req, res, next) => {
		if(isSecure(req) || req.path.split("/")[1] == ".well-known"){
			next()
		}
		else if(redirectTarget){
			res.redirect(`https://${redirectTarget}${req.url}`)
		}
		else{
			res.status(500).send("gateway_HOST is missing or unparseable, so there is no HTTPS redirect target")
		}
	})
}

app.use((req, res, next) => {
	delete req.headers.authorization
	req.headers["x-forwarded-for"] = req.ip || req.socket.remoteAddress || ""
	req.headers["x-forwarded-proto"] = isSecure(req) ? "https" : "http"
	req.headers["x-forwarded-host"] = req.headers.host || ""
	next()
})

const services = require("./services.js")
for(const apiService of services){
	const {serviceOn, log, postPathRegex, getPathRegex, deletePathRegex, putPathRegex, patchPathRegex, baseURL} = apiService

	if(serviceOn){
		console.log(log)
		const anchor = (re) => new RegExp(`^(?:${re.source})`)
		const postRe = anchor(postPathRegex)
		const getRe = anchor(getPathRegex)
		const deleteRe = deletePathRegex && anchor(deletePathRegex)
		const putRe = putPathRegex && anchor(putPathRegex)
		const patchRe = patchPathRegex && anchor(patchPathRegex)
		const sources = [postRe.source, getRe.source]
		if (deleteRe) sources.push(deleteRe.source)
		if (putRe) sources.push(putRe.source)
		if (patchRe) sources.push(patchRe.source)
		app.use(new RegExp(sources.join("|")), createProxyMiddleware((pathname, req) => {
			return (postRe.test(pathname) && req.method === "POST")
				|| (getRe.test(pathname) && req.method === "GET")
				|| (deleteRe && deleteRe.test(pathname) && req.method === "DELETE")
				|| (putRe && putRe.test(pathname) && req.method === "PUT")
				|| (patchRe && patchRe.test(pathname) && req.method === "PATCH")
		}, {
			target: baseURL,
			logLevel: "silent",
		}))
	}
}

module.exports = app