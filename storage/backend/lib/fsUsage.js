const path = require("path")
const fs = require("fs")
const { mapLimit } = require("lib")

const FS_CONCURRENCY = 64

const CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH, "shared/captures")
const OBJECT_CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH, "objectCaptures")

const dirFileBytes = async (dir) => {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])
	const files = entries.filter((entry) => entry.isFile())
	const sizes = await mapLimit(files, FS_CONCURRENCY, async (entry) => {
		const { size } = await fs.promises.stat(path.join(dir, entry.name)).catch(() => ({ size: 0 }))
		return size
	})
	return sizes.reduce((sum, size) => sum + size, 0)
}

module.exports = { FS_CONCURRENCY, CAPTURES_DIR, OBJECT_CAPTURES_DIR, dirFileBytes }
