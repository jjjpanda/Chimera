
const { Server } = require("socket.io");
const ioClient = require("socket.io-client")

const cron = require("node-cron")
const { isPrimeInstance } = require("lib")

let scheduledTaskConfigs = {}
let scheduledTask={}

let converterProcesses = {}

module.exports = {
    server: () => {
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
            });

            console.log(`🧠 Memory On ▶ PORT ${process.env.memory_PORT}`)
            
            io.on('connection', client => {
                client.on('log', data => console.log(data));
                client.on('cron', (cronString, cronTask) => { 
                    const fileStatsCron = cron.schedule(cronString, cronTask)
                    fileStatsCron.start()
                })
                client.on('createTask', (taskObject, task) => {
                    scheduledTaskConfigs[taskObject.id] = taskObject
                    scheduledTask[taskObject.id] = cron.schedule(
                        taskObject.cronString, 
                        task, 
                        { scheduled: true }
                    )
                    scheduledTask[taskObject.id].start()
                })
                client.on('startTask', (id, callback=()=>{}) => {
                    scheduledTask[id].start()
                    scheduledTaskConfigs[id].running = true
                    callback(scheduledTaskConfigs)
                })
                client.on('stopTask', (id, callback=()=>{}) => {
                    scheduledTask[id].stop()
                    scheduledTaskConfigs[id].running = false
                    callback(scheduledTaskConfigs)
                })
                client.on('destroyTask', (id, callback=()=>{}) => {
                    scheduledTask[id].destroy()
                    delete scheduledTask[id]
                    delete scheduledTaskConfigs[id]
                    callback(scheduledTaskConfigs)
                })
                client.on('listTask', (callback=()=>{}) => {
                    callback(scheduledTaskConfigs)
                })

                client.on('saveProcess', (id, process, callback=()=>{}) => {
                    converterProcesses[id] = process
                    callback(id)
                })
                client.on('cancelProcess', (id, type, callback=()=>{}) => {
                    let msg = 'not cancelled'
                    if(type == "mp4"){
                        converterProcesses[id].kill()
                        delete converterProcesses[id]
                        msg = `Your video (${id}) was cancelled.`
                    }
                    else if(type == "zip"){
                        converterProcesses[id].abort()
                        delete converterProcesses[id]
                        msg = `Your archive (${id}) was cancelled.`
                    }
                    callback(msg)
                })
                client.on('disconnect', () => { /* ... */ });
            });
        }
    },

    client: (clientName) => {
        const socket = ioClient(process.env.memory_HOST, {
            withCredentials: true,
            extraHeaders: {
                "Authorization": process.env.memory_AUTH_TOKEN
            }
        })

        socket.on("connect", () => {
            console.log(`▶ 🧠 CONNECTED ${clientName} | ID: ${socket.id} | Instance ${process.env.NODE_APP_INSTANCE}`)
        })

        return socket
    }
}