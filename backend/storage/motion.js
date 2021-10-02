require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../lib/validators.js')

const app = express.Router();



module.exports = app