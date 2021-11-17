module.exports = {
	processListMiddleware: (manager) => (req, res) => {
		const {processName} = req
		getProcessList(manager, processName, res.send)
	},

	checkProcess: (manager, name, successCallback, failureCallback) => {
		getProcessList(manager, name, ({processList}) => {
			if(processList.length > 0){
				successCallback()
			}
			else{
				failureCallback()
			}
		})
	}
}

const getProcessList = (manager, processName, callback) => {
	manager.list((err, list) => {
		let processList = (err ? [] : list)
		if(processName){
			processList = processList.filter((p) => {
				return p.name && p.name.includes(processName)
			}).map(({name, pm2_env}) => ({name, status: pm2_env.status, restarts: pm2_env.unstable_restarts}))
		}
		callback({processList})
	})
}