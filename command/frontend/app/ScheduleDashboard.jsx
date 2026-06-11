import React, { useState } from "react"
import moment from "moment"
import cronstrue from "cronstrue"
import { RotateCcw, Square, Trash2 } from "lucide-react"

import useTasks from "../hooks/useTasks.js"
import useScheduler from "../hooks/useScheduler.js"
import useCameras from "../hooks/useCameras.js"
import useTaskRuns from "../hooks/useTaskRuns.js"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table"

import CameraDateNumberPicker from "./CameraDateNumberPicker"
import Scheduler from "./Scheduler"

import { cn } from "../lib/utils"

const humanCron = (cronString) => {
	if (!cronString) return cronString ?? ""
	try {
		return cronstrue.toString(cronString)
	} catch {
		return cronString
	}
}

const taskSummary = (task) => {
	const label = task.url?.split("/").filter(Boolean).join(" › ") ?? task.url ?? "—"
	const cam = task.body?.camera ? `cam ${task.body.camera}` : null
	return cam ? `${label} · ${cam}` : label
}

const ScheduleDashboard = ({ mobile = false }) => {
	const [{ processList, loading }, restartTask, stopTask, deleteTask] = useTasks()
	const [scheduleTask] = useScheduler()
	const [cameras] = useCameras()
	const [{ runs, loading: runsLoading }, refreshRuns] = useTaskRuns()

	const [pickerState, setPickerState] = useState(null)
	const [outputType, setOutputType] = useState("video")

	const buildBody = (state) => {
		const cam = cameras[state.camera]
		if (!cam) return null
		return {
			camera: String(cam.id),
			start: moment(state.startDate).second(0).format("YYYYMMDD-HHmmss"),
			end: moment(state.endDate).second(0).format("YYYYMMDD-HHmmss"),
			skip: state.number,
			save: true,
		}
	}

	const handleSchedule = (url, _body, cronString) => {
		if (!pickerState) return
		const body = buildBody(pickerState)
		if (!body) return
		scheduleTask(url, JSON.stringify(body), cronString, () => {
			setPickerState(null)
		})
	}

	const url = outputType === "video" ? "/convert/createVideo" : "/convert/createZip"
	const body = pickerState ? JSON.stringify(buildBody(pickerState) ?? {}) : "{}"

	return (
		<div className="flex flex-col gap-6">
			<div className={cn("flex gap-6", mobile ? "flex-col" : "flex-col xl:flex-row")}>
			<Card className="flex-1 bg-surface border-border">
				<CardHeader>
					<CardTitle className="text-primary">Scheduled Tasks</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<p className="text-muted text-sm">Loading…</p>
					) : processList.length === 0 ? (
						<p className="text-muted text-sm">No scheduled tasks.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="border-border">
									<TableHead className="text-muted">ID</TableHead>
									<TableHead className="text-muted">Schedule</TableHead>
									<TableHead className="text-muted">Task</TableHead>
									<TableHead className="text-muted">Status</TableHead>
									<TableHead className="text-muted text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{processList.map((task) => (
									<TableRow key={task.id} className="border-border">
										<TableCell className="text-primary font-mono text-xs">{task.id}</TableCell>
										<TableCell className="text-primary text-xs max-w-40 truncate" title={humanCron(task.cronString)}>
											{humanCron(task.cronString)}
										</TableCell>
										<TableCell className="text-muted text-xs max-w-48 truncate" title={taskSummary(task)}>
											{taskSummary(task)}
										</TableCell>
										<TableCell>
											<Badge className={task.running ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted"}>
												{task.running ? "running" : "stopped"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<Button variant="ghost" size="icon" onClick={() => restartTask(task.id)} title="Restart">
													<RotateCcw className="h-4 w-4 text-accent" />
												</Button>
												<Button variant="ghost" size="icon" onClick={() => stopTask(task.id)} title="Stop">
													<Square className="h-4 w-4 text-muted" />
												</Button>
												{!task.protected && (
													<Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)} title="Destroy">
														<Trash2 className="h-4 w-4 text-danger" />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card className={cn("bg-surface border-border", mobile ? "w-full" : "w-full xl:w-96 xl:shrink-0")}>
				<CardHeader>
					<CardTitle className="text-primary">Schedule a Task</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<CameraDateNumberPicker
						numberType="Skip"
						onChange={setPickerState}
					/>

					<Separator className="bg-border" />

					<Tabs value={outputType} onValueChange={setOutputType}>
						<TabsList className="bg-surface-raised">
							<TabsTrigger value="video" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
								Video
							</TabsTrigger>
							<TabsTrigger value="zip" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
								Zip
							</TabsTrigger>
						</TabsList>
					</Tabs>

					<Scheduler
						url={url}
						body={body}
						onEnter={handleSchedule}
					/>
				</CardContent>
			</Card>
			</div>

			<Card className="bg-surface border-border">
				<CardHeader>
					<CardTitle className="text-primary">Run History</CardTitle>
				</CardHeader>
				<CardContent>
					{runsLoading ? (
						<p className="text-muted text-sm">Loading…</p>
					) : runs.length === 0 ? (
						<p className="text-muted text-sm">No runs recorded yet.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="border-border">
									<TableHead className="text-muted">Task</TableHead>
									<TableHead className="text-muted">URL</TableHead>
									<TableHead className="text-muted">Status</TableHead>
									<TableHead className="text-muted">HTTP</TableHead>
									<TableHead className="text-muted">Error</TableHead>
									<TableHead className="text-muted">When</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{runs.map((run) => (
									<TableRow key={run.id} className="border-border">
										<TableCell className="text-primary font-mono text-xs">{run.task_id}</TableCell>
										<TableCell className="text-muted text-xs max-w-40 truncate" title={run.url}>{run.url}</TableCell>
										<TableCell>
											<Badge className={run.status === "success" ? "bg-accent text-accent-foreground" : "bg-danger text-white"}>
												{run.status}
											</Badge>
										</TableCell>
										<TableCell className="text-muted text-xs">{run.http_status ?? "—"}</TableCell>
										<TableCell className="text-muted text-xs max-w-48 truncate" title={run.error ?? ""}>{run.error ?? "—"}</TableCell>
										<TableCell className="text-muted text-xs" title={run.ran_at}>{moment(run.ran_at).fromNow()}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

export default ScheduleDashboard
