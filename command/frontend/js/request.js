import { saveAs } from "file-saver"
import toast from "./toast.js"

const request = (url, opt, callback) => {
	return callback(fetch(url, opt))
}

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

const downloadProcessing = (prom, callback) => {
	prom.then(resp => resp.blob()).then(blob => {
		const fr = new FileReader()
		fr.onload = () => {
			let res
			try {
				res = JSON.parse(fr.result)
			} catch (e) {
				res = undefined
			}

			if (res !== undefined) {
				if (res.frameLimitMet) {
					toast("Size Limit Met")
				} else if (res.url === undefined) {
					toast("No Frames")
				}
				setTimeout(() => callback && callback(), 2500)
			} else {
				saveAs(blob)
				if (callback) callback()
			}
		}
		fr.readAsText(blob)
	})
}

export { request, statusProcessing, jsonProcessing, downloadProcessing }
