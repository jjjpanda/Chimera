require("dotenv").config()
const mkdirp = require('mkdirp')

mkdirp(process.env.password_FILEPATH, (made) => {
    console.log(`password hash file was${ made ? "" : " not" } made`)
    if(made){
        process.exit(0)
    }
    else{
        process.exit(1)
    }
})