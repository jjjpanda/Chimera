const { createPool } = require("lib")

const BULK_TIMEOUT_MS = 300000
const BULK_CHECKOUT_TIMEOUT_MS = 30000

module.exports = {
	BULK_TIMEOUT_MS,
	pool: createPool("STORAGE POOL ERROR"),
	bulkPool: createPool("STORAGE BULK POOL ERROR", {
		max: 5,
		connectionTimeoutMillis: BULK_CHECKOUT_TIMEOUT_MS,
		statement_timeout: BULK_TIMEOUT_MS,
		query_timeout: BULK_TIMEOUT_MS + 1000
	})
}
