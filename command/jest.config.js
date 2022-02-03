module.exports = {
	displayName: "command",
	clearMocks: true,
	moduleFileExtensions: [
		"js",
		"jsx",
		"json"
	],
	setupFiles: ["dotenv/config"],
	testTimeout: 10000,
	transform: {
		"\\/(frontend|backend|dist)\\/.+\\.jsx?$": "babel-jest"
	}
}
