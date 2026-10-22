var express    = require("express")
const path = require("path")
const helmet = require("helmet")
const httpProxy = require("http-proxy")
const { helmetOptions, redirectTarget, trustProxyHops, isHealthPath } = require("lib")

var app = express()
const trustHops = trustProxyHops()
const trustProxy = trustHops > 0
if(trustProxy){
	app.set("trust proxy", trustHops)
}

app.use("/.well-known/", express.static(path.join(__dirname, "../.well-known/"), {
	dotfiles: "allow"
}))

app.use(helmet(helmetOptions))

const forwardedProto = (req) => {
	const values = (req.headers["x-forwarded-proto"] || "").split(",")
	const index = Math.max(0, values.length - trustHops)
	return (values[index] ?? values[0]).trim().toLowerCase()
}
const isSecure = (req) => !!req.socket.encrypted || (trustProxy && forwardedProto(req) == "https")

if(process.env.gateway_HTTPS_Redirect == "true"){
	const target = redirectTarget({ trustProxy })
	app.use((req, res, next) => {
		if(isSecure(req) || req.path.split("/")[1] == ".well-known" || isHealthPath(req.path)){
			next()
		}
		else if(target){
			res.redirect(`https://${target}${req.url}`)
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
		const proxy = httpProxy.createProxyServer({ target: baseURL })
		proxy.on("error", (err, req, res) => {
			if(!res.headersSent) res.writeHead(err.code == "ECONNREFUSED" ? 504 : 500)
			res.end()
		})
		const shouldProxy = (pathname, req) => {
			return (postRe.test(pathname) && req.method === "POST")
				|| (getRe.test(pathname) && req.method === "GET")
				|| (deleteRe && deleteRe.test(pathname) && req.method === "DELETE")
				|| (putRe && putRe.test(pathname) && req.method === "PUT")
				|| (patchRe && patchRe.test(pathname) && req.method === "PATCH")
		}
		app.use(new RegExp(sources.join("|")), (req, res, next) => {
			if(!shouldProxy(req.originalUrl.split("?")[0], req)) return next()
			req.url = req.originalUrl
			proxy.web(req, res)
		})
	}
}

module.exports = app