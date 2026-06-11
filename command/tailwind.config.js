/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: ["./frontend/index.html", "./frontend/**/*.{js,jsx}"],
	theme: {
		extend: {
			colors: {
				bg: "#050505",
				surface: {
					DEFAULT: "#0F0F12",
					raised: "#17171C"
				},
				accent: {
					DEFAULT: "#8f0b0b",
					foreground: "#FFFFFF"
				},
				secondary: {
					DEFAULT: "#9651d2",
					foreground: "#FFFFFF"
				},
				primary: "#F5F5F7",
				muted: "#8a8a94",
				border: "#27272A",
				info: {
					DEFAULT: "#24B2F0",
					foreground: "#081018"
				},
				danger: {
					DEFAULT: "#912a2a",
					foreground: "#FFFFFF"
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
	plugins: [require("tailwindcss-animate")]
}
