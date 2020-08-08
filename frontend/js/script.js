var logger = document.getElementById('log');
const log = (...arguments) => {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'object') {
            logger.innerHTML = (JSON && JSON.stringify ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + '<br />' + logger.innerHTML;
        } else {
            logger.innerHTML = arguments[i] + '<br />' + logger.innerHTML;
        }
    }
}

const request = (url, opt, callback) => {
    callback(fetch(url, opt))
}

const jsonProcessing = (prom, callback) => {
    prom
    .then(res => res.text())
    .then((res) => {
      try {
        const resp = JSON.parse(res)
        return resp
      } catch (e) {
        return res
      }
    })
    .then((data) => callback(data))
}

document.getElementById('convert').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value.split('-').join("").split(":").join("").replace("T", "-")+"00"
    const endDate = document.getElementById('endDate').value.split('-').join("").split(":").join("").replace("T", "-")+"00"
    if(startDate.length != 15 || endDate.length != 15){
        alert('Please input 2 dates to convert between.')
    }
    else{
        request("/createVideo", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                camera: document.getElementById('camera').value,
                start: startDate,
                end: endDate,
            })
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                log(data)
            })
        })
    }   
})

document.getElementById('zip').addEventListener('click', () => {
    const startDate = document.getElementById('startDate').value.split('-').join("").split(":").join("").replace("T", "-")+"00"
    const endDate = document.getElementById('endDate').value.split('-').join("").split(":").join("").replace("T", "-")+"00"
    if(startDate.length != 15 || endDate.length != 15){
        alert('Please input 2 dates to convert between.')
    }
    else{
        request("/createZip", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                camera: document.getElementById('camera').value,
                start: startDate,
                end: endDate,
            })
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                log(data)
            })
        })
    }
})

document.getElementById('on').addEventListener('click', () => {
    request("/motionStart", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('motion').addEventListener('click', () => {
    request("/motionStatus", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('off').addEventListener('click', () => {
    request("/motionStop", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

