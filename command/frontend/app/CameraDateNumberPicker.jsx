import React from "react"
import { RotateCcw, Check } from "lucide-react"

import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"
import useCameras from "../hooks/useCameras.js"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"

import moment from "moment"

const CameraDateNumberPicker = (props) => {
	const [cameras] = useCameras()
	const [state, setState] = useCamDateNumInfo({ ...props, modified: false })

	const update = (patch) => setState((s) => ({ ...s, ...patch, modified: true }))

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
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label>Start</Label>
						<Input
							type="datetime-local"
							value={state.startDate.format("YYYY-MM-DDTHH:mm")}
							onChange={(e) => update({ startDate: moment(e.target.value) })}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>End</Label>
						<Input
							type="datetime-local"
							value={state.endDate.format("YYYY-MM-DDTHH:mm")}
							onChange={(e) => update({ endDate: moment(e.target.value) })}
						/>
					</div>
				</div>
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
