const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200 || status == 204,
})

module.exports = (content, level="default", isError=()=>{}) => {
	const url = level == "admin" ? process.env.admin_alert_URL : process.env.alert_URL
	axios.post(url, {
		content
	}, {
		headers: { "Content-Type": "application/json" }
	}).then(() => {
		console.log("Webhook alert sent")
		isError(false)
	}).catch(({message}) => {
		console.log("Error sending alert: ", message, "| WITH CONTENT:", content)
		isError(true)
	})
}