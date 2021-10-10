module.exports = {
    validateBody: (req, res, next) => {
        if( req.body != undefined ){
            next()
        }
        else{
            res.send(JSON.stringify({
                error: true,
                msg: "no body"
            }))
        }
    },

    validateRequestURL: (url) => {
        switch (url){
            case "/createVideo":
            case "/listFramesVideo":
            case "/createZip":
            case "/statusProcess":
            case "/cancelProcess":
            case "/listProcess":
            case "/deleteProcess":
            case "/motionStart":
            case "/motionStatus":
            case "/motionStop":
            case "/serverUpdate":
            case "/serverStatus":
            case "/serverInstall":
            case "/serverStop":
            case "/pathSize":
            case "/pathFileCount":
            case "/pathDelete":
            case "/pathClean":
            case "/scheduleTask":
            case "/destroyTask":
                return true
            default: 
                return false
        }
    }
}