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
	// the selection in effect, and the last one that actually loaded — a rejected or superseded load falls back to it
	const selected = useRef(language)
	const loaded = useRef("en")

	// both a failed chunk and a failed save leave the app on the language it was already able to render
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
					loaded.current = language
					document.documentElement.lang = language
					localStorage.setItem("language", language)
				}
				// a superseded chunk defines its moment locale as it lands, so the selected one has to re-assert itself
				applyMomentLocale(selected.current)
			})
			.catch(() => {
				applyMomentLocale(selected.current)
				if (!stale) rollback(loaded.current, "language.loadFailed")()
			})
		return () => { stale = true }
	}, [language])

	const applyLanguage = (next) => {
		const previous = language
		setLanguage(next)
		if (loggedIn) saveLanguage(next, rollback(previous, "language.saveFailed"))
	}

	return (
		<LanguageContext.Provider value={{ language, applyLanguage }}>
			{children}
		</LanguageContext.Provider>
	)
}

export const useLanguage = () => useContext(LanguageContext)
