const fs = require("fs")
const os = require("os")
const path = require("path")

process.env.storage_FOLDERPATH = fs.mkdtempSync(path.join(os.tmpdir(), "chimera-storage-"))
fs.mkdirSync(path.join(process.env.storage_FOLDERPATH, "shared/captures"), { recursive: true })
