module.exports = (instances) => {
	const val = (instances || "").trim()
	const num = Number(val)
	return val === "max" || (val !== "" && Number.isInteger(num) && (num === 0 || num === -1 || num > 1))
}
