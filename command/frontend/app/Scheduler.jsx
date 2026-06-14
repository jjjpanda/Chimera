import React, { useState } from "react"

import cronstrue from "cronstrue"

import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"

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

const Scheduler = ({ cronString: initial = "", url, onEnter }) => {
	const [cronString, setCronString] = useState(initial)

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<Input
					value={cronString}
					onChange={(e) => setCronString(e.target.value)}
					placeholder="* * * * *"
				/>
				<Button disabled={cronIsInvalid(cronString)} onClick={() => onEnter(url, cronString)}>
					Schedule
				</Button>
			</div>
			<p className="min-h-5 text-sm text-muted">{humanReadableCron(cronString)}</p>
		</div>
	)
}

export default Scheduler
