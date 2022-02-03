module.exports = {
	client: (name) => ({
		emit: (event, ...args) => {
			if(event == "savePassword"){
				args[1]()
			}
			else if(event == "verifyPassword"){
				args[1](false)
			}
		},
		on: () => {}
	}),
	server: () => {}
}