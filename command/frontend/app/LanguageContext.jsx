import React, { createContext, useContext, useEffect, useRef, useState } from "react"
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

const saveLanguage = (language, onFailure) =>
	request("/authorization/language", {
		method: "PUT",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ language })
	}, (prom) => prom
		.then((res) => { if (!res.ok) throw new Error() })
		.catch(onFailure))

export const LanguageProvider = ({ serverLanguage, loggedIn, children }) => {
	const [language, setLanguage] = useState(() => resolveLanguage(localStorage.getItem("language")) ?? detectLanguage())
	const selected = useRef(language)
	const loaded = useRef("en")
	const picked = useRef(null)

	const rollback = (previous, messageKey) => () => {
		toast(i18n.t(messageKey))
		setLanguage(previous)
	}

	useEffect(() => {
		if (!loggedIn) return
		setLanguage(resolveLanguage(serverLanguage) ?? "en")
	}, [serverLanguage, loggedIn])

	useEffect(() => {
		let stale = false
		selected.current = language
		changeLanguage(language, () => !stale)
			.then(() => {
				if (!stale) {
					const previous = loaded.current
					loaded.current = language
					document.documentElement.lang = language
					localStorage.setItem("language", language)
					if (loggedIn && picked.current === language) {
						picked.current = null
						saveLanguage(language, () => {
							if (!stale) rollback(previous, "language.saveFailed")()
						})
					}
				}
				applyMomentLocale(selected.current)
			})
			.catch(() => {
				applyMomentLocale(selected.current)
				if (!stale) rollback(loaded.current, "language.loadFailed")()
			})
		return () => { stale = true }
	}, [language])

	const applyLanguage = (next) => {
		picked.current = next
		setLanguage(next)
	}

	return (
		<LanguageContext.Provider value={{ language, applyLanguage }}>
			{children}
		</LanguageContext.Provider>
	)
}

export const useLanguage = () => useContext(LanguageContext)
