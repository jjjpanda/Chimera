const { customAlphabet } = require("nanoid")
const charList = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()" 

module.exports = {
	generate: (size=13) => {
		return customAlphabet(charList, size)()
	}
}