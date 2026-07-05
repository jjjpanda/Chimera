module.exports = (socket) => ({
	sessionInvalidate: (jti) => socket.broadcast.emit("sessionInvalidate", jti),
	sessionInvalidateUser: (username) => socket.broadcast.emit("sessionInvalidateUser", username),
	sessionInvalidateAll: () => socket.broadcast.emit("sessionInvalidateAll")
})
