import pw from "lib/utils/password.json"

const messages = {
	TOO_MANY_ATTEMPTS: "Too many attempts",
	INVALID_CREDENTIALS: "Invalid username or password.",
	INVALID_USERNAME: "Username must be 3-50 characters and contain only letters, numbers, dashes, dots, and underscores.",
	SETUP_TOKEN_MISMATCH: "Setup token does not match setup_TOKEN in .env",
	WRONG_CURRENT_PASSWORD: "Current password is incorrect",
	PASSWORD_TOO_SHORT: `Password must be at least ${pw.minLength} characters.`,
	CANNOT_DEMOTE_LAST_ADMIN: "Cannot demote the last admin",
	CANNOT_DELETE_LAST_ADMIN: "Cannot delete the last admin"
}

export default (code) => (code ? messages[code] ?? code : code)
