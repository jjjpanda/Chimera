import React, { createContext, useContext, useEffect, useState } from "react"
import { request } from "../js/request.js"
import toast from "../js/toast.js"
import i18n from "../js/i18n.js"
import { resolveLanguage, detectLanguage } from "../js/languages.js"

const LanguageContext = createContext({ language: "en", applyLanguage: () => {} })

const saveLanguage = (language) =>
	request("/authorization/language", {
		method: "PUT",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ language })
	}, (prom) => prom
		.then((res) => { if (!res.ok) throw new Error() })
		.catch(() => toast(i18n.t("language.saveFailed"))))

export const LanguageProvider = ({ serverLanguage, loggedIn, children }) => {
	const [language, setLanguage] = useState(() => resolveLanguage(localStorage.getItem("language")) ?? detectLanguage())

	useEffect(() => {
		if (!loggedIn) return
		const resolved = resolveLanguage(serverLanguage) ?? "en"
		setLanguage(resolved)
		localStorage.setItem("language", resolved)
	}, [serverLanguage, loggedIn])

	useEffect(() => {
		i18n.changeLanguage(language)
		document.documentElement.lang = language
		localStorage.setItem("language", language)
	}, [language])

	const applyLanguage = (next) => {
		setLanguage(next)
		if (loggedIn) saveLanguage(next)
	}

	return (
		<LanguageContext.Provider value={{ language, applyLanguage }}>
			{children}
		</LanguageContext.Provider>
	)
}

export const useLanguage = () => useContext(LanguageContext)
