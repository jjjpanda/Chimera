module.exports = (io) => {
const passwords = new Set()
return {
	savePassword: (password, callback=()=>{}) => {
		passwords.add(password)
		callback()
	},
	verifyPassword: (password, callback=()=>{}) => {
		callback(passwords.has(password))
	},
	deletePassword: (password, callback=()=>{}) => {
		passwords.delete(password)
		callback()
	}
}
}
