let unauthorizedHandled = false

const handleUnauthorized = (url, res) => {
	if (unauthorizedHandled) return res
	if (res.status !== 401 && res.status !== 403) return res
	if (String(url).startsWith("/authorization")) return res
	unauthorizedHandled = true
	window.location.assign("/login")
	return res
}

const request = (url, opt, callback) => {
	return callback(fetch(url, opt).then(res => handleUnauthorized(url, res)))
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
