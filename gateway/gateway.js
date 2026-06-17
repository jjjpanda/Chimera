var express    = require("express")
const path = require("path")
const helmet = require("helmet")
var {
	createProxyMiddleware
}              = require("http-proxy-middleware")
const { helmetOptions } = require("lib")

var app = express()

app.use("/.well-known/", express.static(path.join(__dirname, "../.well-known/"), {
	dotfiles: "allow"
}))

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
	const {serviceOn, log, postPathRegex, getPathRegex, deletePathRegex, baseURL} = apiService

	if(serviceOn){
		console.log(log)
		const anchor = (re) => new RegExp(`^(?:${re.source})`)
		const postRe = anchor(postPathRegex)
		const getRe = anchor(getPathRegex)
		const deleteRe = deletePathRegex && anchor(deletePathRegex)
		const sources = [postRe.source, getRe.source]
		if (deleteRe) sources.push(deleteRe.source)
		app.use(new RegExp(sources.join("|")), createProxyMiddleware((pathname, req) => {
			return (postRe.test(pathname) && req.method === "POST")
				|| (getRe.test(pathname) && req.method === "GET")
				|| (deleteRe && deleteRe.test(pathname) && req.method === "DELETE")
		}, {
			target: baseURL,
			logLevel: "silent",
		}))
	}
}

module.exports = app