const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean"]

module.exports = {
	authorize: (req, res, next) => {
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
		console.log(`PIN: ${process.env.templink_PIN}`)
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