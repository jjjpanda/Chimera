const ROLLBACK_TIMEOUT_MS = 5000

module.exports = async (pool, fn) => {
	const client = await pool.connect()
	try {
		await client.query("BEGIN")
		const result = await fn(client)
		await client.query("COMMIT")
		client.release()
		return result
	} catch (e) {
		const rolledBack = await client.query({ text: "ROLLBACK", query_timeout: ROLLBACK_TIMEOUT_MS }).then(() => true, () => false)
		client.release(rolledBack ? undefined : e)
		throw e
	}
}
