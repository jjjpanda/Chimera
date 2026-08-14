import i18n from "./i18n.js"
import pw from "lib/utils/password.json"

const keys = {
	TOO_MANY_ATTEMPTS: "errors.tooManyAttempts",
	INVALID_CREDENTIALS: "errors.invalidCredentials",
	INVALID_USERNAME: "errors.invalidUsername",
	SETUP_TOKEN_MISMATCH: "errors.setupTokenMismatch",
	WRONG_CURRENT_PASSWORD: "errors.wrongCurrentPassword",
	PASSWORD_TOO_SHORT: "errors.passwordTooShort",
	CANNOT_DEMOTE_LAST_ADMIN: "errors.cannotDemoteLastAdmin",
	CANNOT_DELETE_LAST_ADMIN: "errors.cannotDeleteLastAdmin",
	UPDATE_IN_PROGRESS: "errors.updateInProgress",
	WATCHDOG_DISABLED: "errors.watchdogDisabled"
}

export default (code) => (keys[code] ? i18n.t(keys[code], { minLength: pw.minLength }) : code)
