import React, { createContext, useContext, useEffect, useState } from "react"
import moment from "moment"
import { request } from "../js/request.js"
import toast from "../js/toast.js"
import i18n, { changeLanguage } from "../js/i18n.js"
import { resolveLanguage, detectLanguage, LANGUAGES } from "../js/languages.js"

const identity = (s) => s

const applyMomentLocale = (tag) => {
	const locale = LANGUAGES[tag]?.moment ?? "en"
	moment.updateLocale(locale, { preparse: identity, postformat: identity })
	moment.locale(locale)
}

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
		let stale = false
		changeLanguage(language)
			.then(() => { if (!stale) applyMomentLocale(language) })
			.catch(() => toast(i18n.t("language.loadFailed")))
		document.documentElement.lang = language
		localStorage.setItem("language", language)
		return () => { stale = true }
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
