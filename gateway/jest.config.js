module.exports = {
	displayName: "gateway",
	clearMocks: true,
	moduleFileExtensions: [
		"js",
		"json"
	],
	setupFiles: ["dotenv/config", "<rootDir>/test/setupEnv.js"],
	testTimeout: 10000
}
