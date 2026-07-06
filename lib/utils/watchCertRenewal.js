const fs = require("fs")
const pm2 = require("pm2")
const certPaths = require("./certPaths.js")

const mtime = (p) => { try { return fs.statSync(p).mtimeMs } catch (e) { return null } }

module.exports = (windowStart = 3, windowEnd = 4, intervalMs = 1000 * 60 * 30) => {
	if (process.env.gateway_ON !== "true") return
	const {key, cert} = certPaths()
	const paths = [key, cert]
	if (paths.some(p => !p)) return

	let baseline = paths.map(mtime)
	let pendingRestart = false

	const check = () => {
		const current = paths.map(mtime)
		
		const renewed = current.some((t, i) => t !== null && baseline[i] !== null && t !== baseline[i])
		if (renewed) pendingRestart = true
		
		let initialCreation = false
		current.forEach((t, i) => {
			if (baseline[i] === null && t !== null) {
				baseline[i] = t
				pendingRestart = true
				if (Date.now() - t < intervalMs * 2) initialCreation = true
			}
		})
		
		const hour = new Date().getUTCHours()
		if (initialCreation || (pendingRestart && hour >= windowStart && hour < windowEnd)) {
			baseline = current
			pendingRestart = false
			pm2.restart("gateway", (err) => {
				console.log("🔒 cert renewed → gateway restart", err ? `❌ ${err.message || err}` : "✓")
			})
		}
	}
	
	check()
	return setInterval(check, intervalMs).unref()
}
