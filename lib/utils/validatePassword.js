const { minLength, requirement, tooCommon } = require("./password.json")
const common = new Set(require("./commonPasswords.json"))

const validatePassword = (password) => {
	if (typeof password !== "string" || password.length < minLength) return requirement
	if (common.has(password.toLowerCase())) return tooCommon
	return null
}

module.exports = validatePassword
