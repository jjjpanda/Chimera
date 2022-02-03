let passwords = {}

module.exports = (io) => ({
	savePassword: (password, callback=()=>{}) => {
		passwords[password] = true
		setTimeout(() => {
			delete passwords[password]
		}, 300000) // 5 minutes
		callback()
	},

	verifyPassword: (password, callback=()=>{}) => {
		callback(password in passwords)
	},

	deletePassword: (password, callback=()=>{}) => {
		delete passwords[password]
		callback()
	}
})