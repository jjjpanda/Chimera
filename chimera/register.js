require("dotenv").config()
const { auth } = require("lib")

const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
})

const stdout = process.stdout
const stdin = process.stdin

let input = ""
let retypedInput = ""

const handleNewData = (retyped, c) => {
	switch (c) {
	case "\r":
	case "\n":
	case "\u0004": // Ctrl-D
		return enter(retyped)
	case "\u0003": // Ctrl-C
		return exit(retyped)
	default:
		if (c.charCodeAt(0) === 8) return backspace(retyped)
		else return newchar(retyped, c)
	}
}

const handleTyping = (c) => {
	handleNewData(false, c)
}

const handleRetype = (c) => {
	handleNewData(true, c)
}

const enter = (retyped, bypass=false) => {
	stdout.clearLine()
	stdout.cursorTo(0)
	stdin.removeListener("data", retyped ? handleRetype : handleTyping)

	if(bypass){
		closeOut(true)
	}
	else if(retyped){
		if(retypedInput === input){
			closeOut()
		}
		else{
			console.log("not the same password, rerun to try again")
			process.exit(1)
		}
	}
	else{
		stdin.on("data", handleRetype)
		stdout.write("\nRetype Password:")	
	}
}

const exit = (retyped) => {
	stdin.removeListener("data", retyped ? handleRetype : handleTyping)
	stdin.setRawMode(false)
	stdin.pause()
	process.exit(1)
}

const closeOut = (bypass=false) => {
	auth.register(bypass ? "" : input, pool, () => {
		process.exit(0)
	}, (msg) => {
		console.log(msg)
		process.exit(1)
	})

	stdin.setRawMode(false)
	stdin.pause()
}

const newchar = (retyped, c) => {
	if(retyped){
		retypedInput += c
	}
	else{
		input += c
	}
}

const backspace = (retyped) => {
	if(retyped){
		retypedInput = retypedInput.slice(0, retypedInput.length - 1)
	}
	else{
		input = input.slice(0, input.length - 1)
	}
}

const minutes = 3
setInterval(() => {
	enter(null, true)
}, minutes * 1000 * 60)

stdout.write(`Proceeding with password file in ${minutes} minutes`)
stdout.write("\nCreate Chimera Password:")
stdin.setRawMode(true)
stdin.resume()
stdin.setEncoding("utf-8")
stdin.on("data", handleTyping)