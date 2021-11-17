require("dotenv").config()

module.exports = {
	apps : [{
		script: "server.js",
		name: "chimeraContinuous",
		log: "./chimera.dev.log",
		log_date_format:"YYYY-MM-DD HH:mm:ss",
		watch: ["."],
		ignore_watch: ["shared", "feed", "*.log", process.env.password_FILEPATH],
		env: {
			"NODE_ENV": "development",
		}
	}]
}
