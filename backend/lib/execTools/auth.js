require('dotenv').config()

const secretKey = process.env.SECRETKEY;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

module.exports = {
    auth: (req, res, next) => {
        const { id } = req.body;
        if (id != undefined && req.header('authorization') != undefined && req.header('authorization').split(' ')[0] == 'Bearer') {
            jwt.verify(req.header('authorization').split(' ')[1], secretKey, (err, decoded) => {
            if (err) {
                res.status(401).send({ error: true, unauthorized: true });
            } else {
                next();
            }
            });
        } else res.status(401).send({ error: true, unauthorized: true });
    },

    login: (req, res) => {
        const { password } = req.body;
        const isMatch = bcrypt.compareSync(password, hash)

        const successfulResponse = (token) => ({
            login: { success: true, token: `Bearer ${token}` }
        })

        if (isMatch) {
            jwt.sign({payload: true}, secretKey, { expiresIn: 31556926 },
                (err, token) => {
                    res.json(successfulResponse(token));
                }
            );
        } else {
            res.status(400).json({ error: true, errors: 'Password Incorrect' });
        }
    },

    register: () => {
        let password
        try{
            password = fs.readFileSync(path.resolve(process.env.filePath), {encoding:'utf8', flag:'r'});
        } catch(e) {
            console.log(`NO PASSWORD FILE IN ${process.env.filePath}`)
            return
        }

        const salt = bcrypt.genSaltSync(10)
        const hash = bcrypt.hashSync(password, salt)

        fs.writeFileSync(path.resolve(process.env.filePath, hash))
    }
}
