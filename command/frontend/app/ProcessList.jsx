import React, { useState } from "react"
import useProcesses from "../hooks/useProcesses.js"
import { useRole } from "./AuthContext.jsx"
import CameraDateNumberPicker from "./CameraDateNumberPicker.jsx"
import Scheduler from "./Scheduler.jsx"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogTrigger
} from "../components/ui/dialog"
import { Label } from "../components/ui/label"
import { XCircle, Trash2, Plus, Download } from "lucide-react"
import { cn } from "../lib/utils"
import NavigateToRoute from "./NavigateToRoute"

import moment from "moment"

const ProcessList = (props) => {
	const [state, cancelProcess, deleteProcess, createProcessFn, scheduleProcessFn, dialog, setDialog, onChange] =
		useProcesses({ mobile: props.mobile })
	const role = useRole()

	const [confirmDialog, setConfirmDialog] = useState({ open: false, process: null })

	const openCreate = (processType, days) =>
		setDialog({ open: true, processType, days })

	const closeCreate = () =>
		setDialog({ open: false, processType: null, days: false })

	const handleConfirm = () => {
		const p = confirmDialog.process
		if (!p) return
		if (p.running) cancelProcess(p.id)
		else deleteProcess(p.id)
		setConfirmDialog({ open: false, process: null })
	}

	const typeLabel = (type) =>
		type === "mp4" ? "Video" : type === "zip" ? "Zip" : type ?? "???"

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Processes</CardTitle>
					{props.mini && <NavigateToRoute to="/recordings" />}
				</div>
			</CardHeader>
			<CardContent className={cn("flex flex-col gap-2", props.mini && "max-h-64 overflow-y-auto")}>
				{state.loading && (
					<p className="py-4 text-center text-sm text-muted">Loading…</p>
				)}
				{!state.loading && state.processList.length === 0 && (
					<p className="py-4 text-center text-sm text-muted">No processes</p>
				)}
				{state.processList.map((process) => {
					const requestedTime = moment(process.requested, "YYYYMMDD-HHmmss").format("LLL")
					const startTime = moment(process.start, "YYYYMMDD-HHmmss").format("LLL")
					const endTime = moment(process.end, "YYYYMMDD-HHmmss").format("LLL")
					return (
						<div key={process.id} className="rounded-md border border-border bg-surface p-3 flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium text-primary">
									{typeLabel(process.type)} &mdash; {requestedTime}
								</span>
								{process.running && (
									<Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500">
										Running
									</Badge>
								)}
							</div>
							<div className="flex flex-col gap-0.5 text-xs text-muted">
								<span>Camera: {process.camera}</span>
								<span>Start: {startTime}</span>
								<span>End: {endTime}</span>
							</div>
							{!props.mini && !props.mobile && !process.running && process.type === "mp4" && (
								<video src={process.link ? new URL(process.link, window.location.origin).pathname : undefined} type="video/mp4" controls className="w-32 rounded" />
							)}
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={process.running}
									asChild
								>
									<a href={process.link} download>
										<Download className="mr-1.5 size-3.5" />
										Download
									</a>
								</Button>
								{role === "admin" && (
									<Button
										variant="outline"
										size="sm"
										className="text-danger border-danger hover:bg-danger hover:text-accent-foreground"
										onClick={() => setConfirmDialog({ open: true, process })}
									>
										{process.running
											? <><XCircle className="mr-1.5 size-3.5" />Cancel</>
											: <><Trash2 className="mr-1.5 size-3.5" />Delete</>
										}
									</Button>
								)}
							</div>
						</div>
					)
				})}

				{props.showFooter && role === "admin" && (
					<div className="flex flex-wrap gap-2 pt-2">
						{[
							{ label: "Video", type: "video", days: false },
							{ label: "Zip", type: "zip", days: false },
							{ label: "Scheduled Video", type: "video", days: true },
							{ label: "Scheduled Zip", type: "zip", days: true }
						].map(({ label, type, days }) => (
							<Button
								key={label}
								variant="outline"
								size="sm"
								onClick={() => openCreate(type, days)}
							>
								<Plus className="mr-1.5 size-3.5" />
								{label}
							</Button>
						))}
					</div>
				)}
			</CardContent>

			<Dialog open={dialog.open} onOpenChange={(open) => !open && closeCreate()}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							{dialog.days ? "Schedule" : "Create"} a {dialog.processType}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<CameraDateNumberPicker
							camera={state.camera}
							{...(dialog.days
								? { days: state.days }
								: { startDate: state.startDate, endDate: state.endDate }
							)}
							number={state.number}
							numberType={state.numberType}
							loading={state.disabled}
							onChange={onChange}
							mobile={props.mobile}
						/>
						<div className="flex items-center gap-2">
							<input
								id="download-toggle"
								type="checkbox"
								checked={state.download}
								onChange={(e) => onChange({ download: e.target.checked })}
								className="accent-accent"
							/>
							<Label htmlFor="download-toggle">Download directly</Label>
						</div>
						{dialog.days ? (
							<Scheduler
								url={dialog.processType === "video" ? "/convert/createVideo" : "/convert/createZip"}
								onEnter={(url, cronString) => scheduleProcessFn(dialog.processType, cronString)}
							/>
						) : (
							<DialogFooter>
								<Button variant="outline" onClick={closeCreate}>Cancel</Button>
								<Button onClick={() => createProcessFn(dialog.processType)}>
									Create
								</Button>
							</DialogFooter>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) => !open && setConfirmDialog({ open: false, process: null })}
			>
				<DialogContent className="max-w-xs">
					<DialogHeader>
						<DialogTitle>
							{confirmDialog.process?.running ? "Cancel" : "Delete"} process?
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">This action cannot be undone.</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmDialog({ open: false, process: null })}>
							No
						</Button>
						<Button
							className="bg-danger text-accent-foreground hover:bg-danger/80"
							onClick={handleConfirm}
						>
							Yes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}

export default ProcessList
