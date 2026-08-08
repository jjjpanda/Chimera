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
				"'sha256-NkTDLBBEOHErWQKbXezMlL9haxm7GKorJeSbdnKNxqM='"
			],
			"worker-src": [
				"'self'",
				"blob:"
			],
			"upgrade-insecure-requests": null
		}
	}
}
