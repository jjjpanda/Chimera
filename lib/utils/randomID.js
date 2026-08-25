const crypto = require("crypto")
const charList = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()" 

module.exports = {
	generate: (size=13) => {
		let id = ""
		const bytes = crypto.randomBytes(size)
		for (let i = 0; i < bytes.length; i++) {
			id += charList[bytes[i] % 64]
		}
		return id
	}
}