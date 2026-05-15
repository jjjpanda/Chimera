const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")

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

	schedulableUrls: schedulableUrls
}