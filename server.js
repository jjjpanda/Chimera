var express    = require('express')
var serveIndex = require('serve-index')
require('dotenv').config()
 
var app = express()
 
// Serve URLs like /ftp/thing as public/ftp/thing
// The express.static serves the file contents
// The serveIndex is this module serving the directory
app.use('/', express.static(process.env.filePath), serveIndex(process.env.filePath, {'icons': true}))
 
// Listen
app.listen(process.env.PORT || 3000)