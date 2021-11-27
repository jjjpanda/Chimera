let lib = jest.requireActual('lib')

lib.auth.authorize = jest.fn().mockImplementation((req={headers:{}}, res, next) => {
    const {method} = req
    if(req.headers.cookie == "validCookie"){
        next()
    }
    else{
        method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
    }
})

module.exports = lib