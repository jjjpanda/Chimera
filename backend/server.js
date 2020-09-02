require('dotenv').config()
console.log("Starting Process:")

if(process.env.webServer == 'on'){

  console.log("Starting Web Server", " >> PORT: ", process.env.PORT)
  require('./lib/webServer.js')()

}


