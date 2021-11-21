const { Server } = require("socket.io")

const { isPrimeInstance } = require("lib")

const {createTask, startTask, stopTask, destroyTask, listTasks} = require('./lib/scheduledTasks.js')
const {saveProcessEnder, cancelProcess} = require('./lib/converterProcesses.js')
const cronTask = require('./lib/cronTask.js')

module.exports = () => {
    if(process.env.memory_ON == "true" && isPrimeInstance){
        
        const io = new Server(process.env.memory_PORT, { 
            cors: {
                origin: false,
                allowedHeaders: ["Authorization"],
                credentials: true
            },
            allowRequest: (req, callback) => {
                const authorized = req.headers.authorization == process.env.memory_AUTH_TOKEN
                callback(authorized ? "OK" : "UNAUTHORIZED", authorized)
            }
        })

        console.log(`🧠 Memory On ▶ PORT ${process.env.memory_PORT}`)
        
        io.on("connection", client => {
            client.on("log", data => console.log(data))

            client.on("cron", cronTask)
            
            client.on("createTask", createTask)
            client.on("startTask", startTask)
            client.on("stopTask", stopTask)
            client.on("destroyTask", destroyTask)
            client.on("listTask", listTasks)

            client.on("saveProcessEnder", saveProcessEnder)
            client.on("cancelProcess", cancelProcess)

            client.on("disconnect", () => {
                console.log(`▶ 🧠 CLIENT WITH ID: ${client.id} DISCONNECTED`)
            })
        })

        process.on("SIGINT", () => {
            io.close(()=> {
                console.log(`🧠 Memory Off ❌`)
            })
        })
    }
}