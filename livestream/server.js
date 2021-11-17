module.exports = () => {
	if(process.env.livestream_ON === "true"){
		const successCallback = () => {
			console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
			console.log("\t▶ Livestream Routes:\t /livestream")
		}
		const failureCallback = () => {
			console.log("👀 Livestream Off ❌")
		}

		require("./backend/livestream.js")(successCallback, failureCallback)
	}
}