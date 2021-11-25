require("dotenv").config()
const { auth } = require("lib")

const stdout = process.stdout
const stdin = process.stdin

let input = ""

const handleNewData = (c) => {
	switch (c) {
	case "\r":
	case "\n":
	case "\u0004": // Ctrl-D
		return enter()
	case "\u0003": // Ctrl-C
		return exit()
	default:
		if (c.charCodeAt(0) === 8) return backspace()
		else return newchar(c)
	}
}

const enter = () => {
	stdin.removeListener("data", handleNewData)
	stdout.clearLine()
	stdout.cursorTo(0)
    
	auth().register(input, () => {
		process.exit(0)
	}, (msg) => {
		console.log(msg)
		process.exit(1)
	})

	stdin.setRawMode(false)
	stdin.pause()
}

const exit = () => {
	stdin.removeListener("data", pn)
	stdin.setRawMode(false)
	stdin.pause()
	process.exit(1)
}

const newchar = (c) => {
	input += c
}

const backspace = () => {
	input = input.slice(0, input.length - 1)
}

let seconds = 30
setInterval(() => {
	if(seconds == 0){
		enter()
	}
	seconds--
}, 1000)
stdout.write(`Proceeding with password file in ${seconds} seconds`)
stdout.write("\nPassword:")
stdin.setRawMode(true)
stdin.resume()
stdin.setEncoding("utf-8")
stdin.on("data", handleNewData)


