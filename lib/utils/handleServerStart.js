const process = require("process")
const parsePort = require("./parsePort.js")

module.exports = (app, port, successCallback, failureCallback) => {
	const parsed = parsePort(port)
	if(parsed === null){
		if (typeof failureCallback === "function") failureCallback(new Error(`Invalid port: ${JSON.stringify(port)}`))
		return
	}
	const server = app.listen(parsed, successCallback)
	server.on("error", (err) => {
		if (typeof failureCallback === "function") failureCallback(err)
	})
	process.on("SIGINT", () => {
		server.close()
		failureCallback()
	})
	return server
}