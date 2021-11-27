require("dotenv").config()
const {handleServerStart} = require('lib')
const app = require("./backend/schedule.js")

module.exports = {
	start: () => {
		const successCallback = () => {
			console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
			console.log("\t▶ Scheduler Routes:\t /task")
		}
		const failureCallback = () => {
			console.log("⌚ Schedule Off ❌")
		}
		if(process.env.schedule_ON === "true"){
			return handleServerStart(app, process.env.schedule_PORT, successCallback, failureCallback)
		}
		else{
			failureCallback()
		}
	},

	app
}