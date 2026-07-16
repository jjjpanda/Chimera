import pw from "lib/utils/password.json"

export const MIN_PASSWORD_LENGTH = pw.minLength
export const PASSWORD_REQUIREMENT = pw.requirement
export const validatePassword = (password) =>
	typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH ? null : PASSWORD_REQUIREMENT
