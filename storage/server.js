const {handleServerStart, isPrimeInstance} = require("lib")
const app = require("./backend/storage.js")

module.exports = {
	start: () => {
		const successCallback = () => {
			console.log(`📂 Storage On ▶ PORT ${process.env.storage_PORT}`)
			console.log("\t▶ Converter Routes:\t /converter")
			console.log("\t▶ Motion Routes:\t /motion")
			console.log("\t▶ File Routes:\t /shared")
			if (isPrimeInstance) app.startDbPruning()
		}
		const failureCallback = () => {
			console.log("📂 Storage Off ❌")
		}
		if(process.env.storage_ON === "true"){
			return handleServerStart(app, process.env.storage_PORT, successCallback, failureCallback)
		}	
		else{
			failureCallback()
		}
	},

	app
}