module.exports = {
	displayName: "storage",
	clearMocks: true,
	moduleFileExtensions: [
		"js",
		"json"
	],
	setupFiles: ["dotenv/config", "<rootDir>/test/setupEnv.js"],
	testTimeout: 10000,
	transform: {
		"[\\\\/]node_modules[\\\\/](archiver|compress-commons|crc32-stream|is-stream|minimatch|zip-stream)[\\\\/].+\\.js$": ["babel-jest", {
			configFile: false,
			babelrc: false,
			presets: [["@babel/preset-env", { targets: { node: "current" } }]]
		}]
	},
	transformIgnorePatterns: ["[\\\\/]node_modules[\\\\/](?!(archiver|compress-commons|crc32-stream|is-stream|minimatch|zip-stream)[\\\\/])"]
}
