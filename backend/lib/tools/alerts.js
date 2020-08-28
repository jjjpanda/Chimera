const request  = require('request');

module.exports = {
    sendAlert: (content) => {
        request({
            method: "POST",
            url: process.env.alertURL,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content
            }),
        }, (error, response, body) => {
            if (!error) {
                console.log('Alert Sent')
            } else {
                console.log("Error sending alert: ", error)
            }
        });
    },
}