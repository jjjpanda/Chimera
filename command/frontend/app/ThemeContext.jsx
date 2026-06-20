import React, { createContext, useContext, useEffect, useState } from "react"
import { request } from "../js/request.js"

const ThemeContext = createContext()

const resolveTheme = (theme) => theme === "dark"

const saveTheme = (theme) =>
	request("/authorization/theme", {
		method: "PUT",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ theme })
	}, (prom) => prom.catch(() => {}))

export const ThemeProvider = ({ serverTheme, children }) => {
	const [theme, setTheme] = useState(() => {
		const saved = localStorage.getItem("theme")
		return saved ?? "dark"
	})

	useEffect(() => {
		if (serverTheme) {
			setTheme(serverTheme)
			localStorage.setItem("theme", serverTheme)
		}
	}, [serverTheme])

	useEffect(() => {
		document.documentElement.classList.toggle("dark", resolveTheme(theme))
		localStorage.setItem("theme", theme)
	}, [theme])

	const toggle = () => {
		setTheme(t => {
			const next = t === "dark" ? "light" : "dark"
			saveTheme(next)
			return next
		})
	}

	return (
		<ThemeContext.Provider value={{ dark: resolveTheme(theme), toggle }}>
			{children}
		</ThemeContext.Provider>
	)
}

export const useTheme = () => useContext(ThemeContext)
