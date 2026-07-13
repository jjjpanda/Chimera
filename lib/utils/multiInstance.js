const os = require("os")

const validInstances = (instances) => {
	const val = (instances || "").trim()
	return val === "max" || (/^-?\d+$/.test(val) && parseInt(val) >= -1)
}

const multiInstance = (instances) => {
	const val = (instances || "").trim()
	if (!validInstances(val)) return false
	if (val === "max") return true
	const num = parseInt(val)
	return num === 0 || num === -1 || num > 1
}

const instanceCount = (requested) => {
	const val = (requested || "").trim()
	if (!validInstances(val)) return 1
	if (val === "max") return os.cpus().length
	const num = parseInt(val)
	if (num === 0) return os.cpus().length
	if (num === -1) return Math.max(1, os.cpus().length - 1)
	return num
}

module.exports = { multiInstance, validInstances, instanceCount }
