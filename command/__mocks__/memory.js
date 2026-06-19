const loginAttempts = require("../../memory/lib/loginAttempts.js")
const loginStore = loginAttempts()

module.exports = {
	client: (name) => {
		const sock = {
			emit: (event, ...args) => {
				if(event == "savePassword"){
					args[1]()
				}
				else if(event == "verifyPassword"){
					args[1](false)
				}
				else if(event == "loginCheck"){
					const ack = args.pop()
					loginStore.loginCheck(...args, (blocked) => ack(null, blocked))
				}
				else if(event == "loginFailure"){
					loginStore.loginFailure(...args)
				}
			},
			on: () => {},
			connected: true,
			timeout: () => sock
		}
		return sock
	},
	server: () => {},
	loginAttempts
}