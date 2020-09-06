require('dotenv').config()
console.log("Starting Web Server", " >> PORT: ", process.env.PORT)
require('./lib/webServer.js')()


