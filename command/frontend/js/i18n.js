import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../locales/en.json"
import { LANGUAGES } from "./languages.js"

i18n.use(initReactI18next).init({
	resources: { "en": { translation: en } },
	lng: "en",
	fallbackLng: "en",
	returnEmptyString: false,
	interpolation: { escapeValue: false }
})

export const changeLanguage = async (tag) => {
	if (LANGUAGES[tag] && !i18n.hasResourceBundle(tag, "translation")) {
		const [translation] = await LANGUAGES[tag].load()
		if (translation) i18n.addResourceBundle(tag, "translation", translation.default ?? translation)
	}
	return i18n.changeLanguage(tag)
}

export default i18n
