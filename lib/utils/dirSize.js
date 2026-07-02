const fs = require("fs")
const path = require("path")

const getDirectorySize = async (dirPath) => {
	const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => null)
	if (!entries) return 0

	const CONCURRENCY_LIMIT = parseInt(process.env.storage_DIR_CONCURRENCY) || 20
	let index = 0

	const worker = async () => {
		let workerSize = 0
		while (index < entries.length) {
			const entry = entries[index++]
			if (!entry) continue
			const fullPath = path.join(dirPath, entry.name)
			if (entry.isDirectory()) {
				workerSize += await getDirectorySize(fullPath)
			} else if (entry.isFile()) {
				const stat = await fs.promises.stat(fullPath).catch(() => ({ size: 0 }))
				workerSize += stat.size
			}
		}
		return workerSize
	}

	const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, entries.length) }, worker)
	const sizes = await Promise.all(workers)
	return sizes.reduce((sum, size) => sum + size, 0)
}

module.exports = getDirectorySize
