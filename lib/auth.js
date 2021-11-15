const secretKey = process.env.SECRETKEY;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const randomId = require('./randomID.js');
const webhookAlert = require('./webhookAlert.js');

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean"]

let tempPasswords = {

}

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
                return key == "bearertoken" && value.includes('Bearer')
            })
            if(bearerTokenCookie){
                const bearerToken = bearerTokenCookie.split("=")[1]
                jwt.verify(bearerToken.split("%20")[1], secretKey, (err, decoded) => {
                    if (err) {
                        method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
                    } else {
                        next();
                    }
                });
            }
            else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
        } else method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({error: "unauthorized"})
    },

    passwordCheck: (req, res, next) => {
        const { password } = req.body;
    
        if(password in tempPasswords){
            delete tempPasswords[password]
            next()
        }
        else{
            let hash
            try{
                hash = fs.readFileSync(path.join(process.env.password_FILEPATH), {encoding:'utf8', flag:'r'});
            } catch(e) {
                console.log(`NO HASH FILE AT ${process.env.password_FILEPATH}`)
                res.status(400).json({ error: true, errors: 'Password Unable to Be Verified' });
            }
    
            if(bcrypt.compareSync(password == undefined ? "" : password, hash)){
                next()
            }
            else {
                res.status(400).json({ error: true, errors: 'Password Incorrect' });
            }
        }
    },

    login: (req, res) => {
        jwt.sign({payload: true}, secretKey, { expiresIn: "30d" },
            (err, token) => {
                res.cookie(`bearertoken`, `Bearer ${token}`, {
                    maxAge: 2592000
                })
                res.send({error: false});
            }
        );
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
        const password = randomId.generate() + randomId.generate()
        tempPasswords[password] = true
        setTimeout(() => {
            delete tempPasswords[password];
        }, 300000) // 5 minutes
        webhookAlert(`A login link was requested:\n${process.env.gateway_HOST}/login/${password}\nThis link will expire in 5 minutes or after first use, whichever comes first.`)
        res.send({ error: false, msg: "sending link" })
    },

    register: (successCallback, errorCallback) => {
        let password
        try{
            password = fs.readFileSync(path.join(process.env.password_FILEPATH), {encoding:'utf8', flag:'r'});
        } catch(e) {
            console.log(`NO PASSWORD FILE AT ${process.env.password_FILEPATH}`)
            errorCallback("ERROR NO PASSWORD FILE AT")
        }

        if(process.env.PRINTPASSWORD === "true"){
            console.log(`Password: ${password}`)
        }

        const salt = bcrypt.genSaltSync(10)
        const hash = bcrypt.hashSync(password, salt)

        fs.writeFileSync(path.join(process.env.password_FILEPATH), hash)

        successCallback()
    },

    schedulableUrls: schedulableUrls
}