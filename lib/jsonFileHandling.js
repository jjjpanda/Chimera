const fs = require('fs')

const isStringJSON = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

module.exports = {
    readJSON: (pathToJSON, successCallback, failureCallback=successCallback) => {
        fs.readFile(pathToJSON, (err, data) => { 
            if(!err && isStringJSON(data)){
                successCallback(JSON.parse(data), err)
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
    },

    isStringJSON: isStringJSON
}