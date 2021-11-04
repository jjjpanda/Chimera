const fs = require('fs')

module.exports = {
    readJSON: (pathToJSON, successCallback, failureCallback=successCallback) => {
        fs.readFile(pathToJSON, (err, data) => { 
            if(!err && isStringJSON(data)){
                successCallback(JSON.parse(data))
            }
            else{
                failureCallback({}, err)
            }
        })
    },

    writeJSON: (pathToJSON, data, successCallback, failureCallback=successCallback) => {
        fs.writeFile(pathToJSON, JSON.stringify(data), (err) => {
            if(!err) {
                successCallback()
            }
            else{
                failureCallback(err);
            }
        });
    }
}

const isStringJSON = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}