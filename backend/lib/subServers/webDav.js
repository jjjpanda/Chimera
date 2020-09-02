require('dotenv').config()
var webdav     = require('webdav-server').v2

const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser(process.env.webDavUsername, process.env.webDavPassword, false);

//console.log(userManager.users)

const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, "/", [ 'all' ]);

module.exports = {
    start: () => {
        const server = new webdav.WebDAVServer({
            port: process.env.webdavPORT,
            httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
            privilegeManager: privilegeManager,
            requireAuthentification: true
        });

        server.beforeRequest((arg, next) => {
            console.log('>>', "Request", ">", arg.request.method, arg.user.username, arg.user.uid, arg.fullUri())
            next()
        })

        server.afterRequest((arg, next) => {
            console.log('>>', "Response", ">", arg.response.statusCode, arg.response.statusMessage);
            //console.log(arg.responseBody);
            next();
        });
        
        server.setFileSystem('/webdav', new webdav.PhysicalFileSystem(process.env.webDavfilePath), (success) => {
            server.start(() => console.log('WebDAV On', " >> PORT: ", process.env.webdavPORT));
        })

        return server
    },

    stop: (s) => {
        s.stop()
    }
}