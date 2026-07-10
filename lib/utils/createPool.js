const { Pool } = require("pg")

module.exports = (errorLabel) => {
	const pool = new Pool({
		user: process.env.database_USER,
		host: process.env.database_HOST,
		database: process.env.database_NAME,
		password: process.env.database_PASSWORD,
		port: process.env.database_PORT,
	})
	pool.on("error", (err) => console.log(errorLabel || "POOL ERROR", err))
	return pool
}
