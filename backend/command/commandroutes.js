require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../lib/validators.js')
const {
    auth,
    login
}              = require('../lib/auth.js')

const app = express.Router();

app.post('/login', validateBody, login)
app.post('/verify', auth, (req, res) => {
    res.json({error: false, token: req.header('authorization')})
})

module.exports = app