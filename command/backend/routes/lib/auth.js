const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")
const {randomID, webhookAlert} = require('lib')

const client = require("memory").client("AUTHORIZATION")

module.exports = {
	passwordCheck: (req, res, next) => {
		const { password } = req.body
    
		client.emit('verifyPassword', password, (exists) => {
			if(exists){
				client.emit("deletePassword", password)
				next()
			}
			else{
				fs.readFile(path.join(process.env.password_FILEPATH), {encoding:"utf8", flag:"r"}, (err, hash) => {
					if(!err){
						bcrypt.compare(password == undefined ? "" : password, hash, (err, success) => {
							if(!err && success){
								next()
							}
							else{
								res.status(400).json({ error: true, errors: "Password Incorrect" })
							}
						})
					}
					else{
						console.log(`NO HASH FILE AT ${process.env.password_FILEPATH}`)
						res.status(400).json({ error: true, errors: "Password Unable to Be Verified" })
					}
				})
			}
		})
	},

	login: (req, res) => {
		jwt.sign({payload: true}, secretKey, { expiresIn: "30d" },
			(err, token) => {
				res.cookie("bearertoken", `Bearer ${token}`, {
					maxAge: 2592000000 //ms = 30 days
				})
				res.send({error: false})
			}
		)
	},

	pinCheck: (req, res, next) => {
		const { pin } = req.body

		if(pin == process.env.templink_PIN){
			next()
		}
		else{
			res.status(400).json({ error: true })
		}
	},
    
	generateLink: (req, res) => {
		const password = randomID.generate(50)
		client.emit('savePassword', password, () => {
			webhookAlert(`A login link was requested:\n${process.env.gateway_HOST}/login/${password}\nThis link will expire in 5 minutes or after first use, whichever comes first.`)
			res.send({ error: false, msg: "sending link" })
		})
	}
}