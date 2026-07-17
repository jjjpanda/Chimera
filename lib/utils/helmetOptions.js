module.exports ={
	contentSecurityPolicy: {
		useDefaults: true,
		directives: {
			"default-src": [
				"'self'"
			],
			"media-src": [
				"'self'",
				"blob:",
			],
			"script-src": [
				"'self'",
				"'sha256-UDJDfYNR9RcRnGNxac9NZe0TPPvR0TpWsyEBNqp17zU='"
			],
			"worker-src": [
				"'self'",
				"blob:"
			],
			"upgrade-insecure-requests": null
		}
	}
}
