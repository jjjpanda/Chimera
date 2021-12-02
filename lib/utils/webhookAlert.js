const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200,
})

module.exports = (content, isError=()=>{}) => {
	axios.post(process.env.alert_URL, {
		content
	}, {
		headers: { "Content-Type": "application/json" }
	}).then(() => {
		console.log("Webhook alert sent")
		isError(false)
	}).catch(({message}) => {
		console.log("Error sending alert: ", message)
		isError(true)
	})
}