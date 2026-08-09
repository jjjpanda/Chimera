var express    = require("express")
const path = require("path")
const helmet = require("helmet")
var {
	createProxyMiddleware
}              = require("http-proxy-middleware")
const { helmetOptions, redirectTarget, trustProxyHops } = require("lib")

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

// Read the entry the outermost trusted hop wrote: count back from the end by the number of hops,
// the same way req.ip picks the client out of X-Forwarded-For. With one hop that is the last
// entry, so a client prepending its own "https" cannot skip the redirect. With a CDN in front of
// nginx, gateway_TRUST_PROXY=2 reads the CDN's entry instead of nginx's view of the local hop —
// express's req.secure always takes the first entry, which is why this does not use it.
const forwardedProto = (req) => {
	const values = (req.headers["x-forwarded-proto"] || "").split(",")
	return (values[values.length - trustHops] ?? values[0]).trim().toLowerCase()
}
const isSecure = (req) => !!req.socket.encrypted || (trustProxy && forwardedProto(req) == "https")

if(process.env.gateway_HTTPS_Redirect == "true"){
	const target = redirectTarget({ trustProxy })
	app.use((req, res, next) => {
		if(isSecure(req) || req.path.split("/")[1] == ".well-known"){
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