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

export {request, jsonProcessing}