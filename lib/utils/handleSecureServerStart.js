const https = require("https")
const fs = require("fs")
const certPaths = require("./certPaths.js")

module.exports = (app, port, successCallback, failureCallback) => {
	const {key, cert} = certPaths()
	fs.readFile(key, (err, privateKey) => {
		if(!err){
			fs.readFile(cert, (err, certificate) => {
				if(!err){
					const credentials = {key: privateKey, cert: certificate}
					const server = https.createServer(credentials, app)
					server.on("error", (err) => {
						if (typeof failureCallback === "function") failureCallback(err)
					})
					server.listen(port, successCallback)
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