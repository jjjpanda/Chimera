module.exports = (req, res, next) => {
    if( req.body != undefined ){
        next()
    }
    else{
        res.send(JSON.stringify({
            error: true,
            msg: "no body"
        }))
    }
}