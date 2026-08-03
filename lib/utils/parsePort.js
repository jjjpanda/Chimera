const parsePort = (port) => {
	const parsed = Number(port)
	return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : null
}

module.exports = parsePort
