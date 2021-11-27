require("dotenv").config()
module.exports = {
	server: require('./socket.js'),
	client: require('./client.js')
}