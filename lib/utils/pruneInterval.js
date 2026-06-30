module.exports = (pool, sql) => {
	const prune = () => pool.query(sql).catch(console.error)
	return setInterval(prune, 1000 * 60 * 60 * 12).unref()
}
