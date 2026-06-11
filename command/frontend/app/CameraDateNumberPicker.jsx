import React from "react"
import { RotateCcw, Check } from "lucide-react"

import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"
import useCameras from "../hooks/useCameras.js"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"


const CameraDateNumberPicker = (props) => {
	const [cameras] = useCameras()
	const [state, setState] = useCamDateNumInfo({ ...props, modified: false })

	const update = (patch) => setState((s) => ({ ...s, ...patch, modified: true }))

	const updateDatePart = (field, part, val) => {
		setState(s => {
			const next = s[field].clone()
			if (part === "date") {
				const [y, m, d] = val.split("-")
				next.year(parseInt(y)).month(parseInt(m) - 1).date(parseInt(d))
			} else {
				const [h, min, sec] = val.split(":")
				next.hour(parseInt(h)).minute(parseInt(min)).second(sec ? parseInt(sec) : 0)
			}
			return { ...s, [field]: next, modified: true }
		})
	}

	const onReset = () => setState((s) => ({ ...s, ...props, modified: false }))

	const onConfirm = () => {
		props.onChange(state)
		setState((s) => ({ ...s, modified: false }))
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<Label>Camera</Label>
				<Select value={String(state.camera)} onValueChange={(v) => update({ camera: parseInt(v) })}>
					<SelectTrigger>
						<SelectValue placeholder="Select camera" />
					</SelectTrigger>
					<SelectContent>
						{cameras.map((cam, index) => (
							<SelectItem key={cam.id} value={String(index)}>{cam.name}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{props.days ? (
				<div className="flex flex-col gap-1.5">
					<Label>Days worth</Label>
					<Input
						type="number"
						min={1}
						value={state.days}
						onChange={(e) => update({ days: parseInt(e.target.value) || 1 })}
					/>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 gap-x-3 gap-y-0">
						<Label>Start</Label>
						<Label>End</Label>
					</div>
					<div className="grid grid-cols-2 gap-x-3 gap-y-2">
						<Input type="date" value={state.startDate.format("YYYY-MM-DD")}
							onChange={e => updateDatePart("startDate", "date", e.target.value)} />
						<Input type="date" value={state.endDate.format("YYYY-MM-DD")}
							onChange={e => updateDatePart("endDate", "date", e.target.value)} />
						<Input type="time" step="1" value={state.startDate.format("HH:mm:ss")}
							onChange={e => updateDatePart("startDate", "time", e.target.value)} />
						<Input type="time" step="1" value={state.endDate.format("HH:mm:ss")}
							onChange={e => updateDatePart("endDate", "time", e.target.value)} />
					</div>
				</>
			)}

			<div className="flex items-end gap-2">
				<div className="flex flex-1 flex-col gap-1.5">
					<Label>{props.numberType || "Number"}</Label>
					<Input
						type="number"
						min={1}
						value={state.number}
						onChange={(e) => update({ number: parseInt(e.target.value) || 1 })}
					/>
				</div>
				<Button variant="outline" size="icon" onClick={onReset} title="Reset">
					<RotateCcw />
				</Button>
				<Button size="icon" onClick={onConfirm} disabled={props.disabled} title="Apply">
					<Check />
				</Button>
			</div>
		</div>
	)
}

export default CameraDateNumberPicker
