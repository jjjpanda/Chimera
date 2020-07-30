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

/* document.getElementById('convert').addEventListener('click', () => {
    request("/convert", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            camera: 1,
            fps: 15,
            frames: 150,
            save: false
        })
    }, (res) => {
        res.then((resp) => {
            return resp.blob()
        }).then((blob) => {
            download(blob, "output.mp4")
        })
    })
}) */

document.getElementById('convert1').addEventListener('click', () => {
    request("/convert", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            camera: 1,
            fps: 15,
            frames: 'inf',
            save: true
        })
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('convert2').addEventListener('click', () => {
    request("/convert", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            camera: 2,
            fps: 15,
            frames: "inf",
            save: true
        })
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('convert3').addEventListener('click', () => {
    request("/convert", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            camera: 3,
            fps: 15,
            frames: "inf",
            save: true
        })
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('on').addEventListener('click', () => {
    request("/on", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('off').addEventListener('click', () => {
    request("/off", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('motion').addEventListener('click', () => {
    request("/motion", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('kill').addEventListener('click', () => {
    request("/kill", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})

document.getElementById('selfUpdate').addEventListener('click', () => {
    request("/selfUpdate", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
            log(data)
        })
    })
})