require("dotenv").config()
const fs = require('fs')
const path = require("path")

let env = {
    command: "", 
    gateway: "", 
    lib: "", 
    livestream: "", 
    memory: "", 
    schedule: "", 
    storage: ""
}

let allEnvPresent = true

const writeVarLine = (varName) => {
    if(varName in process.env){
        return `${varName} = ${process.env[varName]}\n`;
    }
    else{
        console.log("MISSING ENV VAR", varName)
        allEnvPresent = false
    }
}

const isFolderCheck = (varName) => {
    try {
        return fs.lstatSync(process.env[varName]).isDirectory()
    }
    catch(e) {
        return false
    }
}

const confirmPath = (varName, shouldBeFolder=false) => {
    const isAbsolutePath =  path.isAbsolute(process.env[varName])
    if(process.env[varName].length != 0 && !isAbsolutePath){
        console.log(varName, "SHOULD BE AN ABSOLUTE PATH")
        allEnvPresent = false
        return
    }
    const isFolder = isFolderCheck(varName)
    if(shouldBeFolder && !isFolder){
        console.log(varName, "SHOULD BE A FOLDER")
        allEnvPresent = false
        return
    }
    if(!shouldBeFolder && isFolder){
        console.log(varName, "SHOULD BE A FILE")
        allEnvPresent = false
        return
    }
    return
}

env.command += writeVarLine("NODE_ENV")

writeVarLine('chimeraInstances')

env.command += writeVarLine("cameras")
env.storage += writeVarLine("cameras")

env.lib += writeVarLine("alert_URL")

env.command += writeVarLine("password_FILEPATH")
env.lib += writeVarLine("password_FILEPATH")
confirmPath("password_FILEPATH")

env.command += writeVarLine("templink_PIN")
env.lib += writeVarLine("templink_PIN")

env.lib += writeVarLine("PRINTPASSWORD")

env.command += writeVarLine("SECRETKEY")
env.lib += writeVarLine("SECRETKEY")

env.gateway += writeVarLine("command_PROXY_ON")
env.gateway += writeVarLine("schedule_PROXY_ON")
env.gateway += writeVarLine("storage_PROXY_ON")
env.gateway += writeVarLine("livestream_PROXY_ON")

env.gateway += writeVarLine("gateway_ON")
env.gateway += writeVarLine("gateway_PORT")

env.command += writeVarLine("gateway_HOST")
env.schedule += writeVarLine("gateway_HOST")
env.storage += writeVarLine("gateway_HOST")

env.gateway += writeVarLine("gateway_PORT_SECURE")

env.lib += writeVarLine("privateKey_FILEPATH")
confirmPath("privateKey_FILEPATH")

env.lib += writeVarLine("certificate_FILEPATH")
confirmPath("certificate_FILEPATH")

env.gateway += writeVarLine("gateway_HTTPS_Redirect")

env.command += writeVarLine("command_ON")

if(process.env.NODE_ENV != "production") {
    env.gateway += writeVarLine("command_PORT")
}
env.command += writeVarLine("command_PORT")

env.gateway += writeVarLine("command_HOST")

env.schedule += writeVarLine("schedule_ON")
env.schedule += writeVarLine("schedule_PORT")

env.gateway += writeVarLine("schedule_HOST")

env.lib += writeVarLine("scheduler_AUTH")
env.schedule += writeVarLine("scheduler_AUTH")

env.storage += writeVarLine("storage_ON")
env.storage += writeVarLine("storage_PORT")

env.gateway += writeVarLine("storage_HOST")

env.storage += writeVarLine("storage_FOLDERPATH")
confirmPath("storage_FOLDERPATH", true)

writeVarLine("storage_MOTION_CONF_FILEPATH")

env.command += writeVarLine("storage_fileStatsUpdateTime")
env.storage += writeVarLine("storage_fileStatsUpdateTime")

env.storage += writeVarLine("ffmpeg_FILEPATH")
confirmPath("ffmpeg_FILEPATH")

env.storage += writeVarLine("ffprobe_FILEPATH")
confirmPath("ffprobe_FILEPATH")

env.livestream += writeVarLine("livestream_ON")
env.livestream += writeVarLine("livestream_PORT")

env.gateway += writeVarLine("livestream_HOST")

env.livestream += writeVarLine("livestream_FOLDERPATH")
confirmPath("livestream_FOLDERPATH", true)

env.memory += writeVarLine("memory_ON")
env.memory += writeVarLine("memory_PORT")
env.memory += writeVarLine("memory_HOST")
env.memory += writeVarLine("memory_AUTH_TOKEN")

if(allEnvPresent){
    Promise.all(Object.entries(env)
        .map(([key, value]) => new Promise((resolve, reject) => {
            fs.writeFile(`${key}/.env`, value, (err) => {
                if(!err) resolve()
                else reject()
            })
        }))
    ).then(() => {
        process.exit(0)
    }, () => {
        process.exit(1)
    })
}
else{
    process.exit(1)
}

