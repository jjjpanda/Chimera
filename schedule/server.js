module.exports = () => {
	if(process.env.schedule_ON === "true"){
		const successCallback = () => {
			console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
			console.log("\t▶ Scheduler Routes:\t /task")
		}
		const failureCallback = () => {
			console.log("⌚ Schedule Off ❌")
		}

		require("./backend/schedule.js")(successCallback, failureCallback)
	}
}