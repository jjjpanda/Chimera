require('dotenv').config()
var webdav     = require('webdav-server').v2

const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser(process.env.webDavUsername, process.env.webDavPassword, false);

//console.log(userManager.users)

const privilegeManager = new webdav.SimplePathPrivilegeManager();
privilegeManager.setRights(user, "/", [ 'all' ]);

module.exports = {
    start: (req, res, next) => {
        req.app.locals['__webdav'] = new webdav.WebDAVServer({
            port: process.env.webdavPORT,
            httpAuthentication: new webdav.HTTPDigestAuthentication(userManager, 'Default realm'),
            privilegeManager: privilegeManager,
            requireAuthentification: true
        });

        req.app.locals['__webdav'].beforeRequest((arg, next) => {
            console.log('>>', "Request", ">", arg.request.method, arg.user.username, arg.user.uid, arg.fullUri())
            next()
        })

        req.app.locals['__webdav'].afterRequest((arg, next) => {
            console.log('>>', "Response", ">", arg.response.statusCode, arg.response.statusMessage);
            //console.log(arg.responseBody);
            next();
        });
        
        req.app.locals['__webdav'].setFileSystem('/webdav', new webdav.PhysicalFileSystem(process.env.webDavfilePath), (success) => {
            req.app.locals['__webdav'].start(() => {
                console.log('WebDAV On', " >> 🥰 PORT: ", process.env.webdavPORT)
                next()
            });
        })
    },

    check: (nexted, switchingOn) => (req, res, next) => {
        if(nexted && (switchingOn ? req.app.locals['__webdav'] == undefined : req.app.locals['__webdav'] != undefined)){
            next()
        }
        else{
            res.send(JSON.stringify({
                running: req.app.locals['__webdav'] != undefined,
            }))
        }
    },

    stop: (req, res, next) => {
        req.app.locals['__webdav'].stop( () => {
            console.log('WebDAV Off', " >> 😪")
            req.app.locals['__webdav'] = undefined
            next()
        })
        
    }
}