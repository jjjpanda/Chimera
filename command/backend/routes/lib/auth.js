const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const {randomID, webhookAlert} = require('lib')

const Pool = require('pg').Pool
const pool = new Pool({
    user: process.env.database_USER,
    host: process.env.database_HOST,
    database: process.env.database_NAME,
    password: process.env.database_PASSWORD,
    port: process.env.database_PORT,
})

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
				pool.query(`SELECT hash FROM auth WHERE username = 'admin'`, (err, values) => {
					if (!err && values.rows.length > 0 && values.rows[0].hash) {
						const {hash} = values.rows[0]
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
						console.log(`NO HASH`)
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