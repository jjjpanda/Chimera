module.exports = () => {
	if(process.env.storage_ON === "true"){
		const successCallback = () => {
			console.log(`📂 Storage On ▶ PORT ${process.env.storage_PORT}`)
			console.log("\t▶ Converter Routes:\t /converter")
			console.log("\t▶ Motion Routes:\t /motion")
			console.log("\t▶ File Routes:\t /shared")
		}
		const failureCallback = () => {
			console.log("📂 Storage Off ❌")
		}
		
		require("./backend/storage.js")(successCallback, failureCallback)
	}	
}