module.exports = (req, res, next) => {
	if( req.body != undefined && Object.keys(req.body).length > 0 ){
		next()
	}
	else{
		res.status(400).send({
			error: true,
			msg: "no body"
		})
	}
}