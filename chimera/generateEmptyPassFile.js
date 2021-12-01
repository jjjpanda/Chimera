require("dotenv").config()
const mkdirp = require('mkdirp')

let made = true
try {
    made = mkdirp.sync(process.env.password_FILEPATH)
} catch(e){
    if(e.code != "EEXIST"){
        made = false
        console.log(`password hash file error`, e)
    }
} finally {
    if(made){
        process.exit(0)
    }
    else{
        process.exit(1)
    }
}