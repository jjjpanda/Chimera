import React, { useState } from "react"

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
	try {
		cronstrue.toString(cronString)
		return false
	} catch (e) {
		return true
	}
}

const Scheduler = ({ cronString: initial = "", url, onEnter, disabled = false }) => {
	const [cronString, setCronString] = useState(initial)

	return (
		<div className="flex flex-col gap-1.5">
			<Label className="text-xs text-muted">CRON expression</Label>
			<div className="flex items-center gap-2">
				<Input
					value={cronString}
					onChange={(e) => setCronString(e.target.value)}
					placeholder="* * * * *"
				/>
				<Button disabled={disabled || cronIsInvalid(cronString)} onClick={() => onEnter(url, cronString)}>
					Schedule
				</Button>
			</div>
			<p className="min-h-5 text-sm text-muted">{humanReadableCron(cronString)}</p>
		</div>
	)
}

export default Scheduler
