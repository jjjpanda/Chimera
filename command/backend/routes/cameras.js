var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

const SENSITIVE_PARAM = /^(username|user|usr|password|passwd|pass|pwd|pw|auth|token|secret|u|p)$/i

const stripCreds = (url) => {
	try {
		const u = new URL(url)
		u.username = ""
		u.password = ""
		for (const key of [...u.searchParams.keys()]) {
			if (SENSITIVE_PARAM.test(key)) u.searchParams.set(key, "***")
		}
		return u.toString()
	} catch {
		return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@]*@/i, "$1")
	}
}

app.get("/", (req, res) => {
	res.json(loadCameras().map(({ id, name, rtsp_url }) => ({ id, name, rtsp_url: stripCreds(rtsp_url) })))
})

module.exports = app
