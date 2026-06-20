const MIN_PASSWORD_LENGTH = 8
const PASSWORD_REQUIREMENT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`

const validatePassword = (password) =>
	typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH ? null : PASSWORD_REQUIREMENT

export { MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENT, validatePassword }
