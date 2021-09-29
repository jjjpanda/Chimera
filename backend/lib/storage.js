require('dotenv').config()
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')

var app = express()

app.use('/convert', require('./subServers/storage.js'))
    
app.use('/shared', serveStatic(path.join(process.env.filePath, 'shared'), {
    index: false,
    setHeaders: (res, path) => {
        res.setHeader('Content-Disposition', contentDisposition(path))
    },
}),
express.static(path.join(process.env.filePath, 'shared')), serveIndex(path.join(process.env.filePath, 'shared'), {
    icons: true,
    stylesheet: path.resolve(__dirname, '../templates/fileStyle.css'),
    template: path.resolve(__dirname, '../templates/fileTemplate.html')
}))

module.exports = () => {
    
    console.log("Storage 📂 On")
    app.listen(process.env.storagePORT)

}