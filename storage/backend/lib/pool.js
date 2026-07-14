const { createPool } = require("lib")

const BULK_TIMEOUT_MS = 300000

module.exports = {
	pool: createPool("STORAGE POOL ERROR"),
	bulkPool: createPool("STORAGE BULK POOL ERROR", {
		max: 5,
		statement_timeout: BULK_TIMEOUT_MS,
		query_timeout: BULK_TIMEOUT_MS + 1000
	})
}
