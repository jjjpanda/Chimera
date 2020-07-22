require('dotenv').config()
console.log("Starting Process:")

if(process.env.converter === "on"){
  
  console.log('Starting Image Conversion')
  require('./converter.js')()

}

if(process.env.mediaServer == "on"){
  
  console.log("Starting Media Server and Streams")
  require('./nodeMediaServer.js')()

}

if(process.env.fileServer == "on"){
  
  console.log('Starting File Server')
  require('./fileServer.js')()

}

if(process.env.webdav == 'on'){

  console.log("Starting WebDav Server")
  require('./webDav.js')()

}