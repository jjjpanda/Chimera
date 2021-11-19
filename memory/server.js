
const { Server } = require("socket.io");
const ioClient = require("socket.io-client")

module.exports = {
    server: () => {
        if(process.env.memory_ON){
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
            
            io.on('connection', client => {
                console.log(client.id)
                client.on('event', data => { console.log(data) });
                client.on('disconnect', () => { /* ... */ });
            });
        }
    },

    client: () => {
        const socket = ioClient(process.env.memory_HOST, {
            withCredentials: true,
            extraHeaders: {
                "Authorization": process.env.memory_AUTH_TOKEN
            }
        })

        socket.on("connect", () => {
            console.log(socket.id)
            setInterval(() => {
                socket.emit("event", {bruh: true})
            }, 1500)
        })
    }
}