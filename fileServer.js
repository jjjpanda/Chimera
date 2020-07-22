var path       = require('path')
var serveIndex = require('serve-index')
var express    = require('express')

var app = express()
 
// Serve URLs like /ftp/thing as public/ftp/thing
// The express.static serves the file contents
// The serveIndex is this module serving the directory
app.use('/', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))

// Listen
module.exports = () => {
    app.listen(process.env.PORT)
}