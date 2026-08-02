const emitted = []
const buffered = []

const deliver = ({ event, args }) => {
	emitted.push({ event, args })
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
}

let connected = true

const c = {
	get connected(){ return connected },
	set connected(v){
		connected = v
		while(connected && buffered.length) deliver(buffered.shift())
	},
	timeout: () => c,
	emit: (event, ...args) => {
		if(connected) deliver({ event, args })
		else buffered.push({ event, args })
	},
	on: () => {}
}

module.exports = {
	__emitted: emitted,
	__client: c,
	client: () => c,
	server: () => {},
	loginAttempts: require("../../memory/lib/loginAttempts.js")
}
