import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "../locales/en.json"
import es from "../locales/es.json"
import fr from "../locales/fr.json"
import de from "../locales/de.json"
import ptBR from "../locales/pt-BR.json"
import ru from "../locales/ru.json"
import zhCN from "../locales/zh-CN.json"
import ja from "../locales/ja.json"
import ko from "../locales/ko.json"
import hi from "../locales/hi.json"
import gu from "../locales/gu.json"

const translations = { "en": en, "es": es, "fr": fr, "de": de, "pt-BR": ptBR, "ru": ru, "zh-CN": zhCN, "ja": ja, "ko": ko, "hi": hi, "gu": gu }

export const resources = Object.fromEntries(Object.entries(translations).map(([tag, translation]) => [tag, { translation }]))

i18n.use(initReactI18next).init({
	resources,
	lng: "en",
	fallbackLng: "en",
	returnEmptyString: false,
	interpolation: { escapeValue: false }
})

export default i18n
