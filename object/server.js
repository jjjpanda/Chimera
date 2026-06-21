const { handleServerStart } = require("lib")
const app = require("./backend/object.js")
const worker = require("./backend/lib/worker.js")

module.exports = {
	start: () => {
		const successCallback = () => {
			console.log(`🔍 Object On ▶ PORT ${process.env.object_PORT}`)
			console.log("\t▶ Object Routes:\t /object")
			worker.startWorkers()
		}
		const failureCallback = () => {
			console.log("🔍 Object Off ❌")
			worker.stopWorkers()
		}
		if (process.env.object_ON === "true") {
			return handleServerStart(app, process.env.object_PORT, successCallback, failureCallback)
		} else {
			failureCallback()
		}
	},

	app,
}
