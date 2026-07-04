module.exports = {
	client: (name) => {
		const c = {
			timeout: () => c,
			emit: (event, ...args) => {
				if(event == "savePassword"){
					args[1]()
				}
				else if(event == "verifyPassword"){
					args[1](false)
				}
				else if(event == "cancelProcess"){
					const [id, type, cb] = args
					const msg = (type == "mp4" || type == "zip") ? `Your ${type} (${id}) was cancelled.` : "not cancelled"
					cb(null, msg)
				}
			},
			on: () => {}
		}
		return c
	},
	server: () => {},
	loginAttempts: require("../../memory/lib/loginAttempts.js")
}