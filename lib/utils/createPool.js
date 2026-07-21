const { Pool } = require("pg")
const readSecret = require("./readSecret.js")

const STATEMENT_TIMEOUT_MS = 30000
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30000

module.exports = (errorLabel, overrides) => {
	const pool = new Pool({
		user: process.env.database_USER,
		host: process.env.database_HOST,
		database: process.env.database_NAME,
		password: readSecret("database_PASSWORD"),
		port: process.env.database_PORT,
		connectionTimeoutMillis: 5000,
		statement_timeout: STATEMENT_TIMEOUT_MS,
		query_timeout: STATEMENT_TIMEOUT_MS + 1000,
		idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
		keepAlive: true,
		keepAliveInitialDelayMillis: 10000,
		...overrides,
	})
	pool.on("error", (err) => console.log(errorLabel || "POOL ERROR", err))
	return pool
}
