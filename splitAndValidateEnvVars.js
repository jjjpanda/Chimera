require("dotenv").config()

// const {
//     //Gateway
//     command_PROXY_ON, schedule_PROXY_ON, storage_PROXY_ON, livestream_PROXY_ON, gateway_ON, gateway_PORT, gateway_HOST, gateway_PORT_SECURE, privateKey_FILEPATH, certificate_FILEPATH, gateway_HTTPS_Redirect,
//     //Command
//     command_ON, command_PORT, command_HOST,
//     //Schedule
//     schedule_ON, schedule_PORT, schedule_HOST, scheduler_AUTH,
//     //Storage
//     storage_ON, storage_PORT, storage_HOST, storage_FILEPATH, storage_MOTION_CONFPATH, storage_fileStatsUpdateTime,
//     //Livestream | note livestream_CAMERA_URL_* can have numbers from 1 to infinity
//     livestream_ON, livestream_PORT, livestream_HOST, livestream_FILEPATH,
//     //Memory
//     memory_ON, memory_PORT, memory_HOST, memory_AUTH_TOKEN,
//     //Other Server Information 
//     chimeraInstances, ffmpeg, ffprobe, cameras, alert_URL, password_FILEPATH, templink_PIN, PRINTPASSWORD, SECRETKEY
// } = process.env

const fs = require('fs')

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
env.lib += writeVarLine("certificate_FILEPATH")

env.gateway += writeVarLine("gateway_HTTPS_Redirect")

env.command += writeVarLine("command_ON")

env.gateway += writeVarLine("command_PORT")
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

env.storage += writeVarLine("storage_FILEPATH")

env.command += writeVarLine("storage_fileStatsUpdateTime")
env.storage += writeVarLine("storage_fileStatsUpdateTime")

env.livestream += writeVarLine("livestream_ON")
env.livestream += writeVarLine("livestream_PORT")

env.gateway += writeVarLine("livestream_HOST")

env.livestream += writeVarLine("livestream_FILEPATH")

env.memory += writeVarLine("memory_ON")
env.memory += writeVarLine("memory_PORT")
env.memory += writeVarLine("memory_HOST")
env.memory += writeVarLine("memory_AUTH_TOKEN")

env.storage += writeVarLine("ffmpeg")
env.storage += writeVarLine("ffprobe")

env.command += writeVarLine("cameras")
env.storage += writeVarLine("cameras")

env.lib += writeVarLine("alert_URL")

env.command += writeVarLine("password_FILEPATH")
env.lib += writeVarLine("password_FILEPATH")

env.lib += writeVarLine("PRINTPASSWORD")

env.command += writeVarLine("SECRETKEY")
env.lib += writeVarLine("SECRETKEY")

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

