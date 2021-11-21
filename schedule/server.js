const {handleServerStart} = require('lib')

module.exports = () => {
	const successCallback = () => {
		console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
		console.log("\t▶ Scheduler Routes:\t /task")
	}
	const failureCallback = () => {
		console.log("⌚ Schedule Off ❌")
	}
	if(process.env.schedule_ON === "true"){
		return handleServerStart(require("./backend/schedule.js"), process.env.schedule_PORT, successCallback, failureCallback)
	}
	else{
		failureCallback()
	}
}