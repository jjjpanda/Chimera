const {handleServerStart, handleSecureServerStart} = require('lib')

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

	const app = require('./gateway.js')

	if(process.env.gateway_ON == "true"){
		handleServerStart(app, process.env.gateway_PORT, successCallback, failureCallback)
		handleSecureServerStart(app, process.env.gateway_PORT_SECURE, successCallbackSecure, failureCallbackSecure)
	}
	else{
		failureCallback()
		failureCallbackSecure()
	}
}