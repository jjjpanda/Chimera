module.exports ={
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			"default-src": [
				"'self'",
				"data:",
				"https://storage.googleapis.com/tfjs-models/",
				"'unsafe-inline'",
				"'unsafe-eval'"
			],
			"media-src": [
				"'self'",
				"blob:",
			],
			"script-src": [
				"'self'",
				"'unsafe-inline'",
				"'unsafe-eval'",
			]
		}
	}
}