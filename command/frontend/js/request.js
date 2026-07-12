const request = (url, opt, callback) => {
	return callback(fetch(url, opt))
}

const authPromiseHandler = (prom) => prom.then(res => res.json()).catch(() => ({ error: true }))

const statusProcessing = (prom, code, callback) => {
	prom
		.then(res => callback(res.status === code))
		.catch(() => callback(false))
}

const jsonProcessing = (prom, callback) => {
	prom
		.then((res) => {
			if (res.status === 304) return undefined
			return res.text().then((text) => {
				try {
					return JSON.parse(text)
				} catch (e) {
					return text
				}
			})
		})
		.then((data) => callback(data))
		.catch(() => callback(undefined))
}

export { request, authPromiseHandler, statusProcessing, jsonProcessing }
