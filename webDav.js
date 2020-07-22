var webdav     = require('webdav-server').v2

const server = new webdav.WebDAVServer({
    port: process.env.webdavPORT
});
module.exports = () => {
    server.setFileSystem('/shared', new webdav.PhysicalFileSystem(process.env.filePath), (success) => {
        server.start(() => console.log('READY'));
    })
}