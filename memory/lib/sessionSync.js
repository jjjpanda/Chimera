module.exports = (socket) => ({
	sessionInvalidate: (jti) => socket.broadcast.emit("sessionInvalidate", jti),
	sessionInvalidateAll: () => socket.broadcast.emit("sessionInvalidateAll")
})
