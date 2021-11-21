const {handleServerStart} = require('lib')

module.exports = () => {
	const successCallback = () => {
		console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
		console.log("\t▶ Livestream Routes:\t /livestream")
	}
	const failureCallback = () => {
		console.log("👀 Livestream Off ❌")
	}
	if(process.env.livestream_ON === "true"){
		handleServerStart(require("./backend/livestream.js"), process.env.livestream_PORT, successCallback, failureCallback)
	}
	else{
		failureCallback()
	}
}