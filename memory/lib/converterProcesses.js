const converterProcesses = new Map()

module.exports = () => ({
	saveProcessEnder: (id, converterProcessEnder, callback=()=>{}) => {
		converterProcesses.set(id, converterProcessEnder)
		callback(id)
	},

	deleteProcessEnder: (id, callback=()=>{}) => {
		converterProcesses.delete(id)
		callback(id)
	},

	cancelProcess: (id, type, callback=()=>{}) => {
		let msg = "not cancelled"
		try{
			converterProcesses.get(id)()
			if(type == "mp4"){
				msg = `Your video (${id}) was cancelled.`
			}
			else if(type == "zip"){
				msg = `Your archive (${id}) was cancelled.`
			}
		}
		catch(e){
			console.log(`failed to delete converter process ${id}`)
		}
		converterProcesses.delete(id)
		callback(msg)
	}

})