require('dotenv').config()
var express    = require('express')

var app = express()

const {auth} = require('../lib/auth.js');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

if(process.env.schedule == "on"){
    app.use('/schedule', [auth, require('./scheduleroutes.js')])
}

module.exports = () => {

    app.listen(process.env.schedulePORT, () => {
        console.log(`Schedule ⌚ On ▶ ${process.env.schedulePORT}`)
    })

}