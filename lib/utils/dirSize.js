const fs = require("fs")
const path = require("path")

const getDirectorySize = async (dirPath) => {
	const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => null)
	if (!entries) return 0
	const sizes = await Promise.all(entries.map(async (entry) => {
		const fullPath = path.join(dirPath, entry.name)
		if (entry.isDirectory()) return getDirectorySize(fullPath)
		if (entry.isFile()) return (await fs.promises.stat(fullPath).catch(() => ({ size: 0 }))).size
		return 0
	}))
	return sizes.reduce((sum, size) => sum + size, 0)
}

module.exports = getDirectorySize
