module.exports = () => {
	const successCallback = () => {
		console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
		console.log("\t▶ Scheduler Routes:\t /task")
	}
	const failureCallback = () => {
		console.log("⌚ Schedule Off ❌")
	}
	if(process.env.schedule_ON === "true"){
		require("./backend/schedule.js")(successCallback, failureCallback)
	}
	else{
		failureCallback()
	}
}