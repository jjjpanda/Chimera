import pw from "lib/utils/password.json"
import errorMessage from "./errors.js"

export const MIN_PASSWORD_LENGTH = pw.minLength
export const PASSWORD_REQUIREMENT = errorMessage("PASSWORD_TOO_SHORT")
export const validatePassword = (password) =>
	typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH ? null : PASSWORD_REQUIREMENT
