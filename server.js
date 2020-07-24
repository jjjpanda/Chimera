require('dotenv').config()
console.log("Starting Process:")

if(process.env.converter === "on"){
  
  console.log('Starting Image Conversion')
  require('./server/converter.js')()

}

if(process.env.mediaServer == "on"){
  
  console.log("Starting Media Server and Streams")
  require('./server/nodeMediaServer.js')()

}

if(process.env.fileServer == "on"){
  
  console.log('Starting File Server')
  require('./server/fileServer.js')()

}

if(process.env.webdav == 'on'){

  console.log("Starting WebDav Server")
  require('./webDav.js')()

}

if(process.env.webServer == "on"){

  console.log("Starting Web Command Server")
  require('./server/webServer.js')()

}