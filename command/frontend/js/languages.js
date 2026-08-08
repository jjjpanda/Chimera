import tags from "lib/utils/languages.json"

export const LANGUAGE_LABELS = {
	"en": "English",
	"es": "Español",
	"fr": "Français",
	"de": "Deutsch",
	"pt-BR": "Português (Brasil)",
	"ru": "Русский",
	"zh-CN": "简体中文",
	"ja": "日本語",
	"ko": "한국어",
	"hi": "हिन्दी",
	"gu": "ગુજરાતી"
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
