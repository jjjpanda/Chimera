require('dotenv').config()
const NodeMediaServer = require('node-media-server')

const config = (record=false) => {
  return {
    logType: 2,
    rtmp: {
        port: process.env.RTMPport,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: process.env.mediaPORT,
        mediaroot: process.env.videoSave,   
        allow_origin: '*'
    },
    relay: {
        ffmpeg: process.env.ffmpeg,
        tasks: [
          ...process.env.cameraUsernames.split(',').map((username, index) => {
            return {
              app: 'cam',
              mode: "static",
              edge: `rtsp://${username}:${process.env.cameraPasswords.split(',')[index]}@${process.env.cameraIPs.split(',')[index]}:${process.env.cameraPORTs.split(',')[index]}/cam/realmonitor?channel=1&subtype=0`,
              name: `live_${index+1}`,
              rtsp_transport : 'tcp' //['udp', 'tcp', 'udp_multicast', 'http']
            }
          }),
        ]
    },
    trans: record ? {
      ffmpeg: process.env.ffmpeg,
      tasks: [
          {
              app: 'cam',
              mp4: true,
              mp4Flags: '[movflags=frag_keyframe+empty_moov]',
          }
      ]
    } : undefined
  }
}


module.exports = {
  start: (record=false) => {
    var nms = new NodeMediaServer(config(record))
    console.log("Media Server On", " >> PORT: ", process.env.mediaPORT)
    nms.run()
    return nms
  },
  
  stop: (n) => {
    n.stop()
  }
}