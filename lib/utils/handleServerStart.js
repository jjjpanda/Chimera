const process = require("process")

module.exports = (app, port, successCallback, failureCallback) => {
	const server = app.listen(port, successCallback)
	process.on("SIGINT", () => {
		server.close()
		failureCallback()
	})
	return server
}