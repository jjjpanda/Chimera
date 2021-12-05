require("dotenv").config()

const cameraURL = (i) => process.env[`livestream_CAMERA_URL_${i}`]

module.exports = JSON.parse(process.env.cameras).map((camera, index) => ({
    name: camera,
    inputUrl: cameraURL(index + 1),
    fps: 0.25,
    alertUrl: process.env.alertUrl
}))