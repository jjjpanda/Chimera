module.exports = {
	"ignorePatterns": [
		"command/frontend/js/lib/*",
		"command/dist",
		"node_modules"
	],
	"env": {
		"browser": true,
		"es2021": true,
		"node": true
	},
	"overrides": [
		{
			"files": ["**/*.test.js", "**/__mocks__/**", "**/jest.config.js"],
			"env": {
				"jest": true
			}
		}
	],
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
	"settings": {
		"react": {
			"version": "detect"
		}
	},
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
		"no-unused-vars": ["error", { "args": "after-used", "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
		"no-empty": "warn",
		"react/no-unescaped-entities": "warn"
	}
}
