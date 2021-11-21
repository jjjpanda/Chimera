const {handleServerStart} = require('lib')

module.exports = () => {
	const successCallback = () => {
		console.log(`📂 Storage On ▶ PORT ${process.env.storage_PORT}`)
		console.log("\t▶ Converter Routes:\t /converter")
		console.log("\t▶ Motion Routes:\t /motion")
		console.log("\t▶ File Routes:\t /shared")
	}
	const failureCallback = () => {
		console.log("📂 Storage Off ❌")
	}
	if(process.env.storage_ON === "true"){
		return handleServerStart(require("./backend/storage.js"), process.env.storage_PORT, successCallback, failureCallback)
	}	
	else{
		failureCallback()
	}
}