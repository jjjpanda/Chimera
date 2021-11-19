
const { Server } = require("socket.io");
const ioClient = require("socket.io-client")

const cron = require("node-cron")
const { isPrimeInstance } = require("lib")

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
                client.on('log', data => { console.log(data) });
                client.on('cron', (cronString, cronTask) => cron.schedule(cronString, cronTask))
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
            console.log(`${clientName} ${socket.id}`)
        })

        return socket
    }
}