var express    = require('express')
var { validateBody, auth } = require('lib')

const app = express.Router();

app.post('/login', validateBody, auth.passwordCheck, auth.login)
app.post('/verify', auth.auth, (req, res) => {
    res.json({error: false })
})

module.exports = app