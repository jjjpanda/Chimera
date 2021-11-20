const request  = require("request")

module.exports = (content, cb=()=>{}) => {
	request({
		method: "POST",
		url: process.env.alert_URL,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			content
		}),
	}, (error) => {
		cb(!error)
		if (!error) {
			console.log("Webhook alert sent")
		} else {
			console.log("Error sending alert: ", error)
		}
	})
}