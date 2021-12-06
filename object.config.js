require("dotenv").config()

const cameraURL = (i) => process.env[`livestream_CAMERA_URL_${i}`]

module.exports = JSON.parse(process.env.cameras).map((camera, index) => ({
    name: camera,
    inputUrl: cameraURL(index + 1),
    fps: 0.25,
    alertUrl: process.env.admin_alert_URL,

    minimumObjectConfidence: 0.9,
    pixelThreshold: 0.1, 
    pixelChangePercentTolerance: 0.05, 

    sizeTolerance: 0.1,
    positionTolerance: 0.1,
    probabilityOfExistenceDecay: 0.95,
}))