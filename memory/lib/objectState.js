const { objectState } = require("lib")

module.exports = () => ({
	objectGetState: (callback=()=>{}) => callback({ config: objectState.getConfig(), status: objectState.getStatus() }),
	objectSetConfig: (updates, callback=()=>{}) => callback(objectState.setConfig(updates || {})),
	objectScan: (camera, callback=()=>{}) => Promise.resolve(objectState.scan(camera)).then(callback).catch(e => callback({ error: e.message }))
})
