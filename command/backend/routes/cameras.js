var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

const stripCreds = (url) => url
	.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, "$1")
	.replace(/([?&](?:username|user|usr|password|passwd|pass|pwd|pw|auth|token|secret|u|p)=)[^&#]*/gi, "$1***")

app.get("/", (req, res) => {
	res.json(loadCameras().map(({ id, name, rtsp_url }) => ({ id, name, rtsp_url: stripCreds(rtsp_url) })))
})

module.exports = app
