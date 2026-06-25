const {handleServerStart} = require("lib")
const app = require("./backend/command.js")

module.exports = {
	start: () => {
		const successCallback = () => {
			console.log(`🎮 Command On ▶ PORT ${process.env.command_PORT}`)
			console.log("\t▶ Authorization Routes:\t /authorization")
			console.log("\t▶ Resource Routes:\t /res")
			console.log("\t▶ Web App Launched")
		}
		const failureCallback = () => {
			console.log("🎮 Command Off ❌")
		} 
		if(process.env.command_ON === "true"){
			if(!process.env.setup_TOKEN){
				throw new Error("setup_TOKEN must be set: /authorization/setup is publicly reachable through the gateway")
			}
			handleServerStart(app, process.env.command_PORT, successCallback, failureCallback)
		}
		else{
			failureCallback()
		}
	},

	app
}
