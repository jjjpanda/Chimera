const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")
const randomId = require("./randomID.js")
const webhookAlert = require("./webhookAlert.js")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean"]

let tempPasswords = {}

module.exports = {
	auth: (req, res, next) => {
		const {method} = req
		if(req.headers.authorization != undefined && req.headers.authorization == process.env.scheduler_AUTH && schedulableUrls.includes(req.path)){
			next()
		}
		else if (req.headers.cookie != undefined) {
			const cookies = req.headers.cookie.split(";")
			const bearerTokenCookie = cookies.find((cookie) => {
				let [key, value] = cookie.split("=")
				return key == "bearertoken" && value.includes("Bearer")
			})
			if(bearerTokenCookie){
				const bearerToken = bearerTokenCookie.split("=")[1]
				jwt.verify(bearerToken.split("%20")[1], secretKey, (err, decoded) => {
					if (err) {
						method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
					} else {
						next()
					}
				})
			}
			else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
		} else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
	},

	passwordCheck: (req, res, next) => {
		const { password } = req.body
    
		if(password in tempPasswords){
			delete tempPasswords[password]
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
		const password = randomId.generate(50)
		tempPasswords[password] = true
		setTimeout(() => {
			delete tempPasswords[password]
		}, 300000) // 5 minutes
		webhookAlert(`A login link was requested:\n${process.env.gateway_HOST}/login/${password}\nThis link will expire in 5 minutes or after first use, whichever comes first.`)
		res.send({ error: false, msg: "sending link" })
	},

	register: (input="", successCallback, errorCallback) => {
		if(input.length == 0){
			console.log("NO PASSWORD ENTERED, USING FILE")
			fs.readFile(path.join(process.env.password_FILEPATH), {encoding:"utf8", flag:"r"}, (err, passwordFromFile) => {
				if(!err){
					saltAndHash(passwordFromFile, successCallback, errorCallback)
				}
				else{
					errorCallback(`NO PASSWORD FILE AT ${process.env.password_FILEPATH}`)
				}
			})
		}
		else{
			saltAndHash(input, successCallback, errorCallback)
		}
	},

	schedulableUrls: schedulableUrls
}

const saltAndHash = (password, successCallback, errorCallback) => {
	if(process.env.PRINTPASSWORD === "true"){
		console.log(`Password: ${password}`)
	}
	bcrypt.genSalt(10, (err, salt) => {
		if(!err){
			bcrypt.hash(password, salt, (err, hash) => {
				if(!err){
					fs.writeFile(path.join(process.env.password_FILEPATH), hash, (err) => {
						if(!err){
							successCallback()
						}
						else{

							errorCallback(`NO PASSWORD FILE AT ${process.env.password_FILEPATH}`)
						}
					})
				}
				else{
					errorCallback(`FAILED TO HASH PASSWORD`)
				}
			})
		}
		else{
			errorCallback(`FAILED TO GENERATE SALT`)
		}
	})
}