import React, { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import cronstrue from "cronstrue"

import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"

const humanReadableCron = (cronString) => {
	try {
		return cronstrue.toString(cronString)
	} catch (e) {
		return ""
	}
}

const cronIsInvalid = (cronString) => {
	if (/(^| )\/\d/.test(cronString)) return true
	try {
		cronstrue.toString(cronString)
		return false
	} catch (e) {
		return true
	}
}

const Scheduler = ({ cronString: initial = "", url, onEnter, disabled = false }) => {
	const { t } = useTranslation()
	const cronId = useId()
	const [cronString, setCronString] = useState(initial)

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={cronId} className="text-xs text-muted">{t("schedule.cronExpression")}</Label>
			<div className="flex items-center gap-2">
				<Input
					id={cronId}
					value={cronString}
					onChange={(e) => setCronString(e.target.value)}
					placeholder="* * * * *"
				/>
				<Button disabled={disabled || cronIsInvalid(cronString)} onClick={() => onEnter(url, cronString)}>
					{t("schedule.schedule")}
				</Button>
			</div>
			<p className="min-h-5 text-sm text-muted">{cronIsInvalid(cronString) ? "" : humanReadableCron(cronString)}</p>
		</div>
	)
}

export default Scheduler
