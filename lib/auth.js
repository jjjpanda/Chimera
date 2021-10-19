const secretKey = process.env.SECRETKEY;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

module.exports = {
    auth: (req, res, next) => {
        
        if (req.header('Cookie') != undefined) {
            const cookies = req.header('Cookie').split(";")
            const bearerTokenCookie = cookies.find((cookie) => {
                let [key, value] = cookie.split("=")
                return key == "bearertoken" && value.includes('Bearer')
            })
            if(bearerTokenCookie){
                const bearerToken = bearerTokenCookie.split("=")[1]
                jwt.verify(bearerToken.split("%20")[1], secretKey, (err, decoded) => {
                    if (err) {
                        res.status(401).send({ error: true, unauthorized: true });
                    } else {
                        next();
                    }
                });
            }
            else res.status(401).send({ error: true, unauthorized: true });
        } else res.status(401).send({ error: true, unauthorized: true });
    },

    login: (req, res) => {
        const { password } = req.body;
        
        let hash
        try{
            hash = fs.readFileSync(path.join(process.env.password_FILEPATH), {encoding:'utf8', flag:'r'});
        } catch(e) {
            console.log(`NO HASH FILE AT ${process.env.password_FILEPATH}`)
            res.status(400).json({ error: true, errors: 'Password Unable to Be Verified' });
        }
    
        const isMatch = bcrypt.compareSync(password == undefined ? "" : password, hash)
        
        if (isMatch) {
            jwt.sign({payload: true}, secretKey, { expiresIn: "30d" },
                (err, token) => {
                    res.cookie(`bearertoken`, `Bearer ${token}`)
                    res.send({error: false});
                }
            );
        } else {
            res.status(400).json({ error: true, errors: 'Password Incorrect' });
        }
    },

    register: (successCallback, errorCallback) => {
        let password
        try{
            password = fs.readFileSync(path.join(process.env.password_FILEPATH), {encoding:'utf8', flag:'r'});
        } catch(e) {
            console.log(`NO PASSWORD FILE AT ${process.env.password_FILEPATH}`)
            errorCallback("ERROR")
        }

        if(process.env.PRINTPASSWORD === "true"){
            console.log(`Password: ${password}`)
        }

        const salt = bcrypt.genSaltSync(10)
        const hash = bcrypt.hashSync(password, salt)

        fs.writeFileSync(path.join(process.env.password_FILEPATH), hash)

        successCallback()
    }
}
