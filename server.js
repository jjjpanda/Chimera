require("dotenv").config()

console.log("--- Starting Servers ---")

const startService = (name, { fatal = false, method = "start" } = {}) => {
	try {
		require(name)[method]()
	} catch (e) {
		console.error(`❌ ${name} failed to start:`, e.message)
		if (fatal) throw e
	}
}

const services = [
	{ name: "command", fatal: true },
	{ name: "storage" },
	{ name: "livestream" },
	{ name: "schedule" },
	{ name: "object" },
	{ name: "memory", fatal: true, method: "server" },
	{ name: "gateway", fatal: true },
]

for (const { name, fatal, method } of services) {
	if (process.env[`${name}_ON`] === "true") startService(name, { fatal, method })
	else console.log(`↷ skipping ${name} (${name}_ON is "${process.env[`${name}_ON`] ?? "unset"}")`)
}