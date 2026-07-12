const process = require("process")

module.exports = (app, port, successCallback, failureCallback) => {
	const server = app.listen(port, successCallback)
	server.on("error", (err) => {
		if (typeof failureCallback === "function") failureCallback(err)
	})
	process.on("SIGINT", () => {
		server.close()
	})
	return server
}