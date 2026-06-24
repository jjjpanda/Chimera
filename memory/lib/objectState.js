const { objectState } = require("lib")

module.exports = () => ({
	objectGetState: (callback=()=>{}) => callback({ config: objectState.getConfig(), status: objectState.getStatus() }),
	objectSetConfig: (updates, callback=()=>{}) => callback(objectState.setConfig(updates || {}))
})
