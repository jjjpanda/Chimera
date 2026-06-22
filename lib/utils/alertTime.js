const moment = require("moment-timezone")

module.exports = (input, parseFormat) => {
	const zone = process.env.alert_TZ || "UTC"
	return input === undefined
		? moment.tz(zone)
		: moment.utc(input, parseFormat).tz(zone)
}
