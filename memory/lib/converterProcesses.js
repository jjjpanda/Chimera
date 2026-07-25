const converterProcesses = new Map()

module.exports = () => ({
	saveProcessEnder: (owner, id, converterProcessEnder, callback=()=>{}) => {
		converterProcesses.set(id, { owner, end: converterProcessEnder })
		callback(id)
	},

	deleteProcessEnder: (id, callback=()=>{}) => {
		converterProcesses.get(id)?.end(false)
		converterProcesses.delete(id)
		callback(id)
	},

	deleteClientProcesses: (owner) => {
		for(const [id, entry] of converterProcesses) if(entry.owner === owner) converterProcesses.delete(id)
	},

	cancelProcess: (id, type, callback=()=>{}) => {
		let msg = "not cancelled"
		try{
			converterProcesses.get(id).end(true)
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