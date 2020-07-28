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
    request("/convert", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            camera: "1", // or 1
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
})

document.getElementById('on').addEventListener('click', () => {
    request("/on", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
        })
    })
})

document.getElementById('off').addEventListener('click', () => {
    request("/off", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
        })
    })
})

document.getElementById('motion').addEventListener('click', () => {
    request("/motion", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
        })
    })
})

document.getElementById('kill').addEventListener('click', () => {
    request("/kill", {
        method: "POST"
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            console.log(data)
        })
    })
})