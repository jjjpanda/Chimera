module.exports = {
	"ignorePatterns": [
		"command/frontend/js/lib/*",
		"command/dist/app.js",
		"command/dist",
		"node_modules"
	],
	"env": {
		"browser": true,
		"es2021": true,
		"node": true,
		"jest": true
	},
	"extends": [
		"eslint:recommended",
		"plugin:react/recommended"
	],
	"parserOptions": {
		"ecmaFeatures": {
			"jsx": true
		},
		"ecmaVersion": 13,
		"sourceType": "module"
	},
	"plugins": [
		"react"
	],
	"rules": {
		"indent": [
			"error",
			"tab"
		],
		"linebreak-style": [
			"error",
			"unix"
		],
		"quotes": [
			"error",
			"double"
		],
		"semi": [
			"error",
			"never"
		],
		"react/prop-types": "warn",
		"no-unused-vars": "warn",
		"no-empty": "warn",
		"react/no-unescaped-entities": "warn"
	}
}
