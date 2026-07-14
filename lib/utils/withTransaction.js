const ROLLBACK_TIMEOUT_MS = 5000

module.exports = async (pool, fn) => {
	const client = await pool.connect()
	let discard
	try {
		await client.query("BEGIN")
		const result = await fn(client)
		await client.query("COMMIT")
		return result
	} catch (e) {
		const rolledBack = await client.query({ text: "ROLLBACK", query_timeout: ROLLBACK_TIMEOUT_MS }).then(() => true, () => false)
		if (!rolledBack) discard = e
		throw e
	} finally {
		client.release(discard)
	}
}
