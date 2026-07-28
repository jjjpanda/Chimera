const os = require("os")
const path = require("path")

process.env.livestream_FOLDERPATH = path.join(os.tmpdir(), "chimera-livestream-test")
process.env.memory_ON = "true"
