const loginAttempts = require("../../memory/lib/loginAttempts.js")
const loginStore = loginAttempts()

module.exports = {
	client: (name) => ({
		emit: (event, ...args) => {
			if(event == "savePassword"){
				args[1]()
			}
			else if(event == "verifyPassword"){
				args[1](false)
			}
			else if(event == "loginCheck"){
				loginStore.loginCheck(...args)
			}
			else if(event == "loginFailure"){
				loginStore.loginFailure(...args)
			}
		},
		on: () => {}
	}),
	server: () => {},
	loginAttempts
}