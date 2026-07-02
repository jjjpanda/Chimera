const fs = require("fs")
const path = require("path")

const getDirectorySize = async (dirPath) => {
	const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => null)
	if (!entries) return 0
	let totalSize = 0
	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry.name)
		if (entry.isDirectory()) {
			totalSize += await getDirectorySize(fullPath)
		} else if (entry.isFile()) {
			totalSize += (await fs.promises.stat(fullPath).catch(() => ({ size: 0 }))).size
		}
	}
	return totalSize
}

module.exports = getDirectorySize
