module.exports = (io) => ({
	sessionInvalidate: (jti) => io.emit("sessionInvalidate", jti),
	sessionInvalidateAll: () => io.emit("sessionInvalidateAll")
})
