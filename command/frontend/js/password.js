import pw from "lib/utils/password.json"
import commonPasswords from "lib/utils/commonPasswords.json"

const common = new Set(commonPasswords)

export const MIN_PASSWORD_LENGTH = pw.minLength
export const PASSWORD_REQUIREMENT = pw.requirement
export const validatePassword = (password) => {
	if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return PASSWORD_REQUIREMENT
	if (common.has(password.toLowerCase())) return pw.tooCommon
	return null
}
