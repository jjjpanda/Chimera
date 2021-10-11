const request  = require('request');

module.exports = (content) => {
    request({
        method: "POST",
        url: process.env.alertURL,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content
        }),
    }, (error) => {
        if (!error) {
            console.log('Alert sent')
        } else {
            console.log("Error sending alert: ", error)
        }
    });
}