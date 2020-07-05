var express    = require('express')
var serveIndex = require('serve-index')
var path       = require('path')
require('dotenv').config()
 
var app = express()
 
// Serve URLs like /ftp/thing as public/ftp/thing
// The express.static serves the file contents
// The serveIndex is this module serving the directory
//app.use('/', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
 
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

var nms = new NodeMediaServer(config)
nms.run();

// Listen
app.listen(process.env.PORT || 8080)