var express    = require('express')
var serveIndex = require('serve-index')
var path       = require('path')
require('dotenv').config()
 
var app = express()
 
// Serve URLs like /ftp/thing as public/ftp/thing
// The express.static serves the file contents
// The serveIndex is this module serving the directory
app.use('/', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
 
// Listen
app.listen(process.env.PORT || 8080)