const plugin = require("tailwindcss/plugin")

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: ["./frontend/index.html", "./frontend/**/*.{js,jsx}"],
	theme: {
		extend: {
			colors: {
				bg: "rgb(var(--color-bg) / <alpha-value>)",
				surface: {
					DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
					raised: "rgb(var(--color-surface-raised) / <alpha-value>)"
				},
				accent: {
					DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
					foreground: "rgb(var(--color-accent-fg) / <alpha-value>)"
				},
				secondary: {
					DEFAULT: "rgb(var(--color-secondary) / <alpha-value>)",
					foreground: "rgb(var(--color-secondary-fg) / <alpha-value>)"
				},
				primary: "rgb(var(--color-primary) / <alpha-value>)",
				muted: "rgb(var(--color-muted) / <alpha-value>)",
				border: "rgb(var(--color-border) / <alpha-value>)",
				info: {
					DEFAULT: "rgb(var(--color-info) / <alpha-value>)",
					foreground: "rgb(var(--color-info-fg) / <alpha-value>)"
				},
				danger: {
					DEFAULT: "rgb(var(--color-danger) / <alpha-value>)",
					foreground: "rgb(var(--color-danger-fg) / <alpha-value>)"
				}
			},
			fontFamily: {
				sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
			},
			borderRadius: {
				lg: "0.5rem",
				md: "0.375rem",
				sm: "0.25rem"
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		plugin(({ addVariant }) => addVariant("pointer-coarse", "@media (pointer: coarse)"))
	]
}
