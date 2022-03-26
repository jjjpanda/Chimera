const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean"]
const objectUrl = "/livestream/feed/"

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
			const objectTokenCookie = cookies.find((cookie) => {
				let [key] = cookie.split("=")
				return key == "objecttoken"
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
			else if(objectTokenCookie){
				const objectToken = objectTokenCookie.split("=")[1]
				if(req.path.includes(objectUrl) && objectToken == process.env.object_AUTH){
					next()
				}
				else{
					method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
				}
			}
			else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
		} else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
	},

	register: (input="", database, successCallback, errorCallback) => {
		if(input.length == 0){
			database.query("SELECT * FROM auth WHERE username = 'admin'").then(values => {
				if(values && values.rows && values.rows.length > 0){
					console.log("USING ALREADY EXISTING PASSWORD")
					successCallback()
				}
				else{
					throw new Error()
				}
			}).catch(() => {
				errorCallback("NO PASSWORD EXISTS, RERUN AND CREATE A PASSWORD")
			})
		}
		else{
			saltAndHash(input, database, successCallback, errorCallback)
		}
	},

	schedulableUrls: schedulableUrls
}

const saltAndHash = (password, database, successCallback, errorCallback) => {
	if(process.env.PRINTPASSWORD === "true"){
		console.log(`Password: ${password}`)
		console.log(`PIN: ${process.env.templink_PIN}`)
	}
	bcrypt.genSalt(10, (err, salt) => {
		if(!err){
			bcrypt.hash(password, salt, (err, hash) => {
				if(!err){
					database.query(`INSERT INTO auth(username, hash) VALUES('admin', '${hash}') ON CONFLICT (username) DO UPDATE SET hash = EXCLUDED.hash;`)
						.then(successCallback).catch(errorCallback)
				}
				else{
					errorCallback("FAILED TO HASH PASSWORD")
				}
			})
		}
		else{
			errorCallback("FAILED TO GENERATE SALT")
		}
	})
}