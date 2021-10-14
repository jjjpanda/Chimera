module.exports = {
    processListMiddleware: (manager) => (req, res) => {
        const {processName} = req
        manager.list((err, list) => {
            let processList = (err ? [] : list)
            if(processName){
                processList = processList.filter((p) => {
                    return p.name && p.name.includes(processName)
                })
            }
            res.send({processList})
        })
    }
}