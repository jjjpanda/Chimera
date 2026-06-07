/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: ["./frontend/index.html", "./frontend/**/*.{js,jsx}"],
	theme: {
		extend: {
			colors: {
				bg: "#130800",
				surface: {
					DEFAULT: "#2A1005",
					raised: "#3D1A0A"
				},
				accent: {
					DEFAULT: "#C97B3A",
					foreground: "#1A0A02"
				},
				primary: "#F5EDE3",
				muted: "#9A7A6A",
				border: "#4A2510",
				danger: {
					DEFAULT: "#E05252",
					foreground: "#F5EDE3"
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
