require('dotenv').config()
var webdav     = require('webdav-server').v2

const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser(process.env.webDavUser, process.env.webDavPassword, true);

const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, process.env.filePath, [ 'all' ]);

const server = new webdav.WebDAVServer({
    port: process.env.webdavPORT,
    httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
    privilegeManager: privilegeManager
});

module.exports = () => {
    server.setFileSystem('/shared', new webdav.PhysicalFileSystem(process.env.filePath), (success) => {
        server.start(() => console.log('READY'));
    })
}