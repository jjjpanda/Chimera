let converterProcesses = {}

module.exports = (io) => ({
    saveProcessEnder: (id, converterProcessEnder, callback=()=>{}) => {
        converterProcesses[id] = converterProcessEnder
        callback(id)
    },

    cancelProcess: (id, type, callback=()=>{}) => {
        let msg = "not cancelled"
        try{
            converterProcesses[id]()
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
        delete converterProcesses[id]
        callback(msg)
    }
   
})