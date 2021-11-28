require("dotenv").config()
const path = require("path")

const cameraURL = (i) => process.env[`livestream_CAMERA_URL_${i}`]

module.exports = [{
    script: `false && ffmpeg -i "${cameraURL(1)}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -filter_complex zmq,drawbox="x=10:y=20:w=200:h=60:c=red" -hls_flags delete_segments -y -c:v libx264 -crf 21 -preset veryfast ${path.join(process.env.livestream_FILEPATH, "feed", "1", "video.m3u8")}`,
    name: `live_stream_cam_box`,
    log: `./log/livestream.box.log`,
    log_date_format:"YYYY-MM-DD HH:mm:ss",
}, {
    script: `ffmpeg -y -i "${cameraURL(1)}" -update 1 -r 1 ${path.join(process.env.livestream_FILEPATH, "feed", "1", "output.jpg")}`,
    name: `live_stream_cam_update`,
    log: `./log/livestream.update.log`,
    log_date_format:"YYYY-MM-DD HH:mm:ss",
}, {
    script: "server.js",
    name: "chimera",
    log: "./log/chimera.log",
    log_date_format:"YYYY-MM-DD HH:mm:ss",
    instances: process.env.chimeraInstances == 1 ? undefined : process.env.chimeraInstances,
    env: {
        "NODE_ENV": "production",
    }
}, {
    script: "object.js",
    name: "object",
    log: "./log/object.log",
    log_date_format:"YYYY-MM-DD HH:mm:ss",
}]