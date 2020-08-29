require('dotenv').config()
var webdav     = require('webdav-server').v2

const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser(process.env.webDavUsername, process.env.webDavPassword, false);

const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, "/", [ 'all' ]);

const server = new webdav.WebDAVServer({
    port: process.env.webdavPORT,
    httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
    privilegeManager: privilegeManager
});

server.afterRequest((arg, next) => {
    console.log('>>', arg.request.method, arg.user.uid, arg.fullUri(), '>', arg.response.statusCode, arg.response.statusMessage);
    //console.log(arg.responseBody);
    next();
});

module.exports = () => {
    server.setFileSystem('/shared', new webdav.PhysicalFileSystem(process.env.webDavfilePath), (success) => {
        server.start(() => console.log('READY'));
    })
}