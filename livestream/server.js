require("dotenv").config()
const {handleServerStart} = require('lib')
const app = require("./backend/livestream.js")

module.exports = {
	start: () => {
		const successCallback = () => {
			console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
			console.log("\t▶ Livestream Routes:\t /livestream")
		}
		const failureCallback = () => {
			console.log("👀 Livestream Off ❌")
		}
		if(process.env.livestream_ON === "true"){
			handleServerStart(app, process.env.livestream_PORT, successCallback, failureCallback)
		}
		else{
			failureCallback()
		}
	},

	app
}