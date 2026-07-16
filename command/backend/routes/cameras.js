var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

const SENSITIVE_PARAM = /user|usr|pass|pwd|pw|auth|token|secret|key|api|phrase|^[up]$/i

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
		return "***"
	}
}

app.get("/", async (req, res) => {
	try {
		res.json((await loadCameras()).map(({ id, name, rtsp_url }) => ({ id, name, rtsp_url: stripCreds(rtsp_url) })))
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.stripCreds = stripCreds
module.exports = app
