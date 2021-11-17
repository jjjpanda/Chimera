const { auth } = require("lib")

module.exports = () => {
	if(process.env.command_ON === "true"){
		const successCallback = () => {
			console.log(`🎮 Command On ▶ PORT ${process.env.command_PORT}`)
			console.log("\t▶ Authorization Routes:\t /authorization")
			console.log("\t▶ Resource Routes:\t /res")
			console.log("\t▶ Web App Launched")
		}
		const failureCallback = (err) => {
			if(err != undefined){
				console.log(err)
			}
			console.log("🎮 Command Off ❌")
		} 

		auth.register(() => {
			require("./backend/command.js")(successCallback, failureCallback)
		})
	}
}
