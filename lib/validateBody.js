module.exports = (req, res, next) => {
	if( req.body != undefined && Object.keys(req.body).length > 0 ){
		next()
	}
	else{
		res.send(JSON.stringify({
			error: true,
			msg: "no body"
		}))
	}
}