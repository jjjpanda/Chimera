const { Pool } = require("pg")

const STATEMENT_TIMEOUT_MS = 30000

module.exports = (errorLabel, overrides) => {
	const pool = new Pool({
		user: process.env.database_USER,
		host: process.env.database_HOST,
		database: process.env.database_NAME,
		password: process.env.database_PASSWORD,
		port: process.env.database_PORT,
		connectionTimeoutMillis: 5000,
		statement_timeout: STATEMENT_TIMEOUT_MS,
		query_timeout: STATEMENT_TIMEOUT_MS + 1000,
		keepAlive: true,
		keepAliveInitialDelayMillis: 10000,
		...overrides,
	})
	pool.on("error", (err) => console.log(errorLabel || "POOL ERROR", err))
	return pool
}
