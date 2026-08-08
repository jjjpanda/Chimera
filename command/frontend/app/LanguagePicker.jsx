import React, { useId } from "react"
import { useTranslation } from "react-i18next"
import { Label } from "../components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { useLanguage } from "./LanguageContext.jsx"
import tags, { LANGUAGES } from "../js/languages.js"

const LanguagePicker = () => {
	const { language, applyLanguage } = useLanguage()
	const { t } = useTranslation()
	const uid = useId()

	return (
		<div className="flex flex-col gap-1">
			<Label id={`${uid}-label`} htmlFor={uid} className="text-primary">{t("language.label")}</Label>
			<Select value={language} onValueChange={applyLanguage}>
				<SelectTrigger id={uid} aria-labelledby={`${uid}-label ${uid}`} className="bg-surface-raised border-border text-primary">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="bg-surface-raised border-border text-primary">
					{tags.map(tag => <SelectItem key={tag} value={tag}>{LANGUAGES[tag].label}</SelectItem>)}
				</SelectContent>
			</Select>
		</div>
	)
}

export default LanguagePicker
