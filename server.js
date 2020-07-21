var express    = require('express')
var serveIndex = require('serve-index')
var webdav     = require('webdav-server').v2
var path       = require('path')
var fs         = require('fs')
var ffmpeg     = require('fluent-ffmpeg');
require('dotenv').config()

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)

slash = (str) => {
  return str.replace(/\\/g, "/")
}
 
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
        port: process.env.streamPORT,
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

/*
*
*
*/

if(process.env.converter === "on"){
  
  const dirList = fs.readdirSync(path.relative(__dirname, path.resolve(process.env.imgDir)))
  console.log(dirList)
  let cameras = []
  for(let i = 0; i < process.env.cameras; i++){
    cameras.push(`${i+1}`)
  }
  console.log(cameras)
  
  const convert = (camera, callback) => {
    
    let files = ""
    if(process.env.frames != "inf"){
      for (const file of dirList.filter(file => file.includes(".jpg") && file.split('-')[0] == camera).slice(-1 * process.env.frames)){
        files += `file '${file}'\r\n` 
      }
    }
    else{
      for (const file of dirList.filter(file => file.includes(".jpg") && file.split('-')[0] == camera)){
        files += `file '${file}'\r\n` 
      }
    }
    
    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${camera}.txt`), files)
    
    /*
    *
    *
    */
    
    let videoCreator = ffmpeg(process.env.imgDir+`/img_${camera}.txt`).inputFormat('concat'); //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
      
    const createVideo = (creator) => {
      creator
      .outputFPS(30)
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
        fs.unlinkSync(path.resolve(process.env.imgDir, `img_${camera}.txt`))
        if(cameras.length > 0){
          callback(cameras.pop(), convert)
        }
      })
      .mergeToFile(`output_${camera}.mp4`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
    }
    
    createVideo(videoCreator)

  }

  convert(cameras.pop(), convert)
    
}

/*
*
*
*/

if(process.env.mediaServer == "on"){
  var nms = new NodeMediaServer(config)
  nms.run();
}

if(process.env.fileServer == "on"){
  var app = express()
 
  // Serve URLs like /ftp/thing as public/ftp/thing
  // The express.static serves the file contents
  // The serveIndex is this module serving the directory
  app.use('/', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))

  // Listen
  app.listen(process.env.PORT)
}

if(process.env.webdav == 'on'){
  const server = new webdav.WebDAVServer({
    port: process.env.webdavPORT
  });
  server.setFileSystem('/shared', new webdav.PhysicalFileSystem(process.env.filePath), (success) => {
    server.start(() => console.log('READY'));
})
}