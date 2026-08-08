import tags from "lib/utils/languages.json"

export const LANGUAGES = {
	"en": { label: "English", moment: "en", cronstrue: "en", load: () => Promise.resolve([]) },
	"es": { label: "Español", moment: "es", cronstrue: "es", load: () => Promise.all([import("../locales/es.json"), import("moment/locale/es")]) },
	"fr": { label: "Français", moment: "fr", cronstrue: "fr", load: () => Promise.all([import("../locales/fr.json"), import("moment/locale/fr")]) },
	"de": { label: "Deutsch", moment: "de", cronstrue: "de", load: () => Promise.all([import("../locales/de.json"), import("moment/locale/de")]) },
	"pt-BR": { label: "Português (Brasil)", moment: "pt-br", cronstrue: "pt_BR", load: () => Promise.all([import("../locales/pt-BR.json"), import("moment/locale/pt-br")]) },
	"ru": { label: "Русский", moment: "ru", cronstrue: "ru", load: () => Promise.all([import("../locales/ru.json"), import("moment/locale/ru")]) },
	"zh-CN": { label: "简体中文", moment: "zh-cn", cronstrue: "zh_CN", load: () => Promise.all([import("../locales/zh-CN.json"), import("moment/locale/zh-cn")]) },
	"ja": { label: "日本語", moment: "ja", cronstrue: "ja", load: () => Promise.all([import("../locales/ja.json"), import("moment/locale/ja")]) },
	"ko": { label: "한국어", moment: "ko", cronstrue: "ko", load: () => Promise.all([import("../locales/ko.json"), import("moment/locale/ko")]) },
	"hi": { label: "हिन्दी", moment: "hi", cronstrue: "en", load: () => Promise.all([import("../locales/hi.json"), import("moment/locale/hi")]) },
	"gu": { label: "ગુજરાતી", moment: "gu", cronstrue: "en", load: () => Promise.all([import("../locales/gu.json"), import("moment/locale/gu")]) }
}

export const resolveLanguage = (tag) => {
	if (typeof tag !== "string" || !tag) return null
	if (tags.includes(tag)) return tag
	const base = tag.split("-")[0].toLowerCase()
	return tags.find((t) => t.split("-")[0].toLowerCase() === base) ?? null
}

export const detectLanguage = () =>
	(navigator.languages?.length ? navigator.languages : [navigator.language]).map(resolveLanguage).find(Boolean) ?? "en"

export default tags
