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

module.exports = { multiInstance, validInstances }
