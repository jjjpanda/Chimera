const {handleServerStart, handleSecureServerStart, watchCertRenewal, isPrimeInstance} = require("lib")
const app = require("./gateway.js")

module.exports = {
	start: () => {
		const securePort = process.env.gateway_PORT_SECURE || 443
		const successCallback = () => {
			console.log(`🗺️ Gateway On ▶ PORT ${process.env.gateway_PORT}`)
		}
		const failureCallback = (err) => {
			if(err != undefined){
				console.log(err)
			}
			console.log("🗺️ Gateway Off ❌")
		}
		const successCallbackSecure = () => {
			console.log(`🗺️🔒 Secure Gateway On ▶ PORT ${securePort}`)
		}
		const failureCallbackSecure = (err) => {
			if(err != undefined){
				console.log(err)
			}
			console.log("🗺️🔒 Secure Gateway Off ❌")
		}
		if(process.env.gateway_ON == "true"){
			handleServerStart(app, process.env.gateway_PORT, successCallback, failureCallback)
			handleSecureServerStart(app, securePort, successCallbackSecure, failureCallbackSecure)
			if (isPrimeInstance && process.env.certbot_ON == "true") watchCertRenewal()
		}
		else{
			failureCallback()
			failureCallbackSecure()
		}
	},

	app
}