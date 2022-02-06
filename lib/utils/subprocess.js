const pm2 = require("pm2")

module.exports = {
	processListMiddleware: (req, res) => {
		const {processName} = req
		getProcessList(processName, (data) => {
			if(data && "processList" in data && data.processList.length > 0){
				res.send(data.processList)
			}
			else{
				res.status(204).json({})
			}
		})
	},

	checkProcess: (name, successCallback, failureCallback) => {
		getProcessList(name, ({processList}) => {
			if(processList.length > 0){
				successCallback()
			}
			else{
				failureCallback()
			}
		})
	},

	restart: (req, res) => {
		const {processName} = req
		pm2.restart(processName, (err, proc) => {
			console.log("ATTEMPTED POST RESTART TO", processName, "ERROR", err)
			res.send({})
		})
	}
}

const getProcessList = (processName, callback) => {
	pm2.list((err, list) => {
		let processList = (err ? [] : list)
		if(processName){
			processList = processList.filter((p) => {
				return p.name && p.name.includes(processName)
			}).map(({name, pm2_env}) => ({name, status: pm2_env.status, restarts: pm2_env.unstable_restarts}))
		}
		callback({processList})
	})
}