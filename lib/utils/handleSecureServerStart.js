const https = require("https")
const fs = require("fs")
const process = require("process")
const certPaths = require("./certPaths.js")
const parsePort = require("./parsePort.js")

module.exports = (app, port, successCallback, failureCallback) => {
	const securePort = parsePort(port)
	if(securePort === null){
		failureCallback(new Error(`Invalid HTTPS port: ${JSON.stringify(port)}`))
		process.exit(1)
		return
	}
	const {key, cert} = certPaths()
	fs.readFile(key, (err, privateKey) => {
		if(!err){
			fs.readFile(cert, (err, certificate) => {
				if(!err){
					const credentials = {key: privateKey, cert: certificate}
					const server = https.createServer(credentials, app)
					server.on("error", (err) => {
						if (typeof failureCallback === "function") failureCallback(err)
						if (!server.listening) process.exit(1)
					})
					server.listen(securePort, successCallback)
				}
				else{
					failureCallback(err)
				}
			})
		}
		else{
			failureCallback(err)
		}
	})
}