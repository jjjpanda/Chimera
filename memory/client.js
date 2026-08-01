const ioClient = require("socket.io-client")
const crypto = require("crypto")

module.exports = (clientName) => {
	const socket = ioClient(process.env.memory_HOST, {
		withCredentials: true,
		extraHeaders: {
			"Authorization": process.env.memory_AUTH_TOKEN
		},
		auth: { ownerID: crypto.randomUUID() }
	})

	socket.on("connect", () => {
		console.log(`▶ 🧠 CONNECTED ${clientName} | ID: ${socket.id} | Instance ${process.env.NODE_APP_INSTANCE}`)
	})

	return socket
}