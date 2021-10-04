const request  = require('request');

module.exports = {
    sendConvertAlert: (content) => {
        request({
            method: "POST",
            url: process.env.alertURL,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content
            }),
        }, (error, response, body) => {
            if (!error) {
                console.log('Video alert sent')
            } else {
                console.log("Error sending video alert: ", error)
            }
        });
    },

    sendScheduleAlert: (content) => {
        request({
            method: "POST",
            url: process.env.scheduleURL,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content
            }),
        }, (error, response, body) => {
            if (!error) {
                console.log('Zip alert sent')
            } else {
                console.log("Error sending zip alert: ", error)
            }
        });
    },
}