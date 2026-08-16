module.exports = {
	displayName: "command",
	clearMocks: true,
	moduleFileExtensions: [
		"js",
		"jsx",
		"json"
	],
	setupFiles: ["<rootDir>/test/polyfills.js", "dotenv/config", "<rootDir>/test/i18nSetup.js"],
	testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
	testTimeout: 10000,
	transform: {
		"[\\\\/](frontend|backend|dist)[\\\\/].+\\.jsx?$": "babel-jest"
	}
}
