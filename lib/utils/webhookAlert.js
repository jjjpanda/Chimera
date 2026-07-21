const readSecret = require("./readSecret.js")
const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200 || status == 204,
})

module.exports = (content, level="default", isError=()=>{}) => {
	const url = level == "admin" ? readSecret("admin_alert_URL") : readSecret("alert_URL")
	axios.post(url, {
		content,
		allowed_mentions: { parse: [] }
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