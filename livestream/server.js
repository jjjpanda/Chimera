module.exports = () => {
	const successCallback = () => {
		console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
		console.log("\t▶ Livestream Routes:\t /livestream")
	}
	const failureCallback = () => {
		console.log("👀 Livestream Off ❌")
	}
	if(process.env.livestream_ON === "true"){
		require("./backend/livestream.js")(successCallback, failureCallback)
	}
	else{
		failureCallback()
	}
}