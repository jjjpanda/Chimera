var express    = require('express')
var serveIndex = require('serve-index')
var path       = require('path')
var fs         = require('fs')
var ffmpeg     = require('fluent-ffmpeg');
require('dotenv').config()

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
 
var app = express()
 
// Serve URLs like /ftp/thing as public/ftp/thing
// The express.static serves the file contents
// The serveIndex is this module serving the directory
app.use('/', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
 
const NodeMediaServer = require('node-media-server')

const config = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: process.env.streamPORT || 8081,
        allow_origin: '*'
    },
    relay: {
        ffmpeg: process.env.ffmpeg,
        tasks: [
          {
            app: 'cam',
            mode: 'static',
            edge: `rtsp://${process.env.name}:${process.env.password}@${process.env.rtspIp1}/cam/realmonitor?channel=1&subtype=0`,
            name: 'cam1',
            rtsp_transport : 'tcp' //['udp', 'tcp', 'udp_multicast', 'http']
          },
          {
            app: 'cam',
            mode: 'static',
            edge: `rtsp://${process.env.name}:${process.env.password}@${process.env.rtspIp2}/cam/realmonitor?channel=1&subtype=0`,
            name: 'cam2',
            rtsp_transport : 'tcp' //['udp', 'tcp', 'udp_multicast', 'http']
          },
          {
            app: 'cam',
            mode: 'static',
            edge: `rtsp://${process.env.name}:${process.env.password}@${process.env.rtspIp3}/cam/realmonitor?channel=1&subtype=0`,
            name: 'cam3',
            rtsp_transport : 'tcp' //['udp', 'tcp', 'udp_multicast', 'http']
          }
        ]
    }
}

const dirList = fs.readdirSync(path.relative(__dirname, path.resolve(process.env.imgDir)))
console.log(dirList)
let files = ""
for (const file of dirList){
  if(file.includes('.jpg')){
    files += `file '${path.relative(__dirname, path.resolve(process.env.imgDir, file))}'\n` 
  }
}
fs.writeFileSync(path.resolve(process.env.imgDir, "img.txt"), files)

/*
*
*
*/

/* let videoCreator = ffmpeg(path.relative(__dirname, path.resolve(process.env.imgDir,"img.txt"))).inputFormat('concat');
  
const createVideo = (creator) => {
  creator
  .outputFPS(12)
  .videoBitrate(1024)
  .videoCodec('libx264')
  .format('mp4')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('progress', function(progress) {
    console.log('Processing: ' + progress.percent + '% done');
  })
  .on('end', function() {
    console.log('Finished processing');
  })
  .mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
}

createVideo(videoCreator) */
  
/*
*
*
*/

if(process.env.mediaServer == "on"){
  var nms = new NodeMediaServer(config)
  nms.run();
}

if(process.env.fileServer == "on"){
  // Listen
  app.listen(process.env.PORT || 8080)
}
