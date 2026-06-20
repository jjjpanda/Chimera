import React, { createContext, useContext, useEffect, useState } from "react"
import { request } from "../js/request.js"
import toast from "../js/toast.js"

const ThemeContext = createContext()

const isDark = (theme) =>
	theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

const saveTheme = (theme) =>
	request("/authorization/theme", {
		method: "PUT",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ theme })
	}, (prom) => prom
		.then((res) => { if (!res.ok) throw new Error() })
		.catch(() => toast("Couldn't save theme")))

export const ThemeProvider = ({ serverTheme, children }) => {
	const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "system")

	useEffect(() => {
		if (serverTheme) {
			setTheme(serverTheme)
			localStorage.setItem("theme", serverTheme)
		}
	}, [serverTheme])

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDark(theme))
		localStorage.setItem("theme", theme)

		if (theme !== "system") return
		const media = window.matchMedia("(prefers-color-scheme: dark)")
		const onChange = () => document.documentElement.classList.toggle("dark", media.matches)
		media.addEventListener("change", onChange)
		return () => media.removeEventListener("change", onChange)
	}, [theme])

	const applyTheme = (next) => {
		setTheme(next)
		saveTheme(next)
	}

	return (
		<ThemeContext.Provider value={{ theme, applyTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}

export const useTheme = () => useContext(ThemeContext)
