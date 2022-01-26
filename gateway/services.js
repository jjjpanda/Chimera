module.exports = [{
	serviceOn: process.env.storage_PROXY_ON === "true",
	log: "📂 Storage Proxied ◀",
	baseURL: process.env.storage_HOST,
	postPathRegex: /\/convert\/(.*Video|.*Zip|.*Process)|\/file\/path.*|\/motion\/.*/,
	getPathRegex: /\/convert\/listProcess|\/shared\/.*|\/file\/path.*|\/motion\/.*|\/database\/.*|\/storage\/health/
}, {
	serviceOn: process.env.schedule_PROXY_ON === "true",
	log: "⌚ Scheduler Proxied ◀",
	baseURL: process.env.schedule_HOST,
	postPathRegex: /\/task\/.*/,
	getPathRegex: /\/schedule\/health|\/memory\/status|\/task\/list/
}, {
	serviceOn: process.env.livestream_PROXY_ON === "true",
	log: "👀 Livestream Proxied ◀",
	baseURL: process.env.livestream_HOST,
	postPathRegex: /\/livestream\/.*/,
	getPathRegex: /\/livestream\/.*/
}, {
	serviceOn: process.env.command_PROXY_ON === "true",
	log: "🎮 Command Proxied ◀",
	baseURL: process.env.command_HOST,
	postPathRegex: /\/.*/,
	getPathRegex: /\/.*/
}]