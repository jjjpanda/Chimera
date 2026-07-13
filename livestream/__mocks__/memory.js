const loginAttempts = require("../../memory/lib/loginAttempts.js")

const sharedStore = () => {
	if(!globalThis.__memoryLoginStore) globalThis.__memoryLoginStore = loginAttempts()
	return globalThis.__memoryLoginStore
}

module.exports = {
	client: () => {
		const sock = {
			emit: (event, ...args) => {
				if(event == "savePassword"){
					args[1]()
				}
				else if(event == "verifyPassword"){
					args[1](false)
				}
				else if(event == "loginReserve"){
					const ack = args.pop()
					sharedStore().loginReserve(...args, (blocked) => ack(null, blocked))
				}
				else if(event == "loginRelease"){
					sharedStore().loginRelease(...args)
				}
			},
			on: () => {},
			get connected(){
				return globalThis.__memoryDisconnected !== true
			},
			timeout: () => sock
		}
		return sock
	},
	server: () => {},
	loginAttempts
}
