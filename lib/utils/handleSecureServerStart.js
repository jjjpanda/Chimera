const https = require("https")
const fs = require("fs")

module.exports = (app, port, successCallback, failureCallback) => {
	fs.readFile(process.env.privateKey_FILEPATH, (err, privateKey) => {
		if(!err){
			fs.readFile(process.env.certificate_FILEPATH, (err, certificate) => {
				if(!err){
					const credentials = {key: privateKey, cert: certificate}
					const server = https.createServer(credentials, app)
					server.listen(port)
					successCallback()
				}
				else{
					failureCallback()
				}
			})
		}
		else{
			failureCallback()
		}
	})
}