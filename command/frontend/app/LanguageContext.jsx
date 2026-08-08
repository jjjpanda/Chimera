import React, { createContext, useContext, useEffect, useState } from "react"
import moment from "moment"
import "moment/locale/es"
import "moment/locale/fr"
import "moment/locale/de"
import "moment/locale/pt-br"
import "moment/locale/ru"
import "moment/locale/zh-cn"
import "moment/locale/ja"
import "moment/locale/ko"
import "moment/locale/hi"
import "moment/locale/gu"
import { request } from "../js/request.js"
import toast from "../js/toast.js"
import i18n from "../js/i18n.js"
import { resolveLanguage, detectLanguage, MOMENT_LOCALES } from "../js/languages.js"

const identity = (s) => s
for (const locale of ["hi", "gu"]) moment.updateLocale(locale, { preparse: identity, postformat: identity })
moment.locale("en")

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
		moment.locale(MOMENT_LOCALES[language] ?? "en")
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
