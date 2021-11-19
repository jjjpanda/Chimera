module.exports = () => {
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
		require("./backend/command.js")(successCallback, failureCallback)
	}
	else{
		failureCallback()
	}
}
