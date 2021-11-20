module.exports ={
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			"default-src": [
				"'self'",
				"data:",
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