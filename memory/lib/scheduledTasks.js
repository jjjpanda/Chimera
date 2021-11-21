const cron = require("node-cron")

let scheduledTaskConfigs = {}
let scheduledTask = {}

module.exports = (io) => ({
    createTask: (taskObject, task) => {
        scheduledTaskConfigs[taskObject.id] = taskObject
        scheduledTask[taskObject.id] = cron.schedule(
            taskObject.cronString, 
            task
        )
        scheduledTask[taskObject.id].start()
    },

    startTask: (id, callback=()=>{}) => {
        scheduledTask[id].start()
        scheduledTaskConfigs[id].running = true
        callback(scheduledTaskConfigs)
    }, 
    
    stopTask: (id, callback=()=>{}) => {
        scheduledTask[id].stop()
        scheduledTaskConfigs[id].running = false
        callback(scheduledTaskConfigs)
    },

    destroyTask: (id, callback=()=>{}) => {
        scheduledTask[id].destroy()
        delete scheduledTask[id]
        delete scheduledTaskConfigs[id]
        callback(scheduledTaskConfigs)
    },

    listTasks:(callback=()=>{}) => {
        callback(scheduledTaskConfigs)
    }
})