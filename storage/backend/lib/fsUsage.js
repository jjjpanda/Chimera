const path = require("path")
const fs = require("fs")
const { mapLimit } = require("lib")

const FS_CONCURRENCY = 64

const CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH || "", "shared/captures")
const OBJECT_CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH || "", "objectCaptures")

const dirFileBytes = async (dir, include = () => true) => {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])
	const files = entries.filter((entry) => entry.isFile() && include(entry.name))
	const sizes = await mapLimit(files, FS_CONCURRENCY, async (entry) => {
		const { size } = await fs.promises.stat(path.join(dir, entry.name)).catch(() => ({ size: 0 }))
		return size
	})
	return sizes.reduce((sum, size) => sum + size, 0)
}

const untrackedSubdirBytes = async (dir, trackedNames) => {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])
	const subdirs = entries.filter((entry) => entry.isDirectory())
	const totals = await mapLimit(subdirs, FS_CONCURRENCY, async (entry) => {
		const tracked = await trackedNames(entry.name)
		return dirFileBytes(path.join(dir, entry.name), (name) => !tracked.has(name))
	})
	return totals.reduce((sum, bytes) => sum + bytes, 0)
}

module.exports = { FS_CONCURRENCY, CAPTURES_DIR, OBJECT_CAPTURES_DIR, dirFileBytes, untrackedSubdirBytes }
