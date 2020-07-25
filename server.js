require('dotenv').config()
console.log("Starting Process:")

if(process.env.converter === "on"){
  
  console.log('Starting Image Conversion')
  require('./backend/converter.js')()

}

if(process.env.mediaServer == "on"){
  
  console.log("Starting Media Server and Streams")
  require('./backend/nodeMediaServer.js')()

}

if(process.env.fileServer == "on"){
  
  console.log('Starting File Server')
  require('./backend/fileServer.js')()

}

if(process.env.webdav == 'on'){

  console.log("Starting WebDav Server")
  require('./backend/webDav.js')()

}

if(process.env.webServer == "on"){

  console.log("Starting Web Command Server")
  require('./backend/webServer.js')()

}