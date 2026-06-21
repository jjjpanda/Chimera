import React, { useState, useEffect } from "react"
import { useRole } from "./AuthContext"
import moment from "moment"
import cronstrue from "cronstrue"
import cronParser from "cron-parser"
import { Trash2, Minus, Plus, ArrowRight } from "lucide-react"

import useTasks from "../hooks/useTasks.js"
import useScheduler from "../hooks/useScheduler.js"
import useCameras from "../hooks/useCameras.js"
import useTaskRuns from "../hooks/useTaskRuns.js"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Switch } from "../components/ui/switch"
import { Label } from "../components/ui/label"
import { Separator } from "../components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog"

import Scheduler from "./Scheduler"
import NavigateToRoute from "./NavigateToRoute.jsx"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { Input } from "../components/ui/input"

const SCHEDULE_PRESETS = [
	{ label: "30m", hours: 0.5 },
	{ label: "1h",  hours: 1 },
	{ label: "4h",  hours: 4 },
	{ label: "12h", hours: 12 },
	{ label: "24h", hours: 24 },
]

import { cn } from "../lib/utils"

const humanCron = (cronString) => {
	if (!cronString) return cronString ?? ""
	try {
		return cronstrue.toString(cronString)
	} catch {
		return cronString
	}
}

const taskSummary = (task, cameras = []) => {
	const parts = task.url?.split("/").filter(Boolean) ?? []
	const label = parts.map((p, i) =>
		i === parts.length - 1 ? p.replace(/^create/i, "").toLowerCase() : p
	).join(" › ") || "—"
	const camId = task.body?.camera
	const cam = camId
		? (cameras.find(c => String(c.id) === String(camId))?.name ?? `cam ${camId}`)
		: null
	const hours = task.body?.hours
	const window = hours != null ? `past ${hours < 1 ? `${hours * 60}m` : `${hours}h`}` : null
	return [label, cam, window].filter(Boolean).join(" · ")
}

const nextRunSeconds = (cronString) => {
	try {
		return moment(cronParser.parseExpression(cronString).next().toString()).diff(moment(), "seconds")
	} catch {
		return Number.MAX_SAFE_INTEGER
	}
}

const ScheduleDashboardMini = ({ withButton }) => {
	const role = useRole()
	const isAdmin = role === "admin"
	const [{ processList, loading }, restartTask, stopTask, deleteTask] = useTasks()
	const [busyId, setBusyId] = useState(null)
	useEffect(() => { setBusyId(null) }, [processList])

	const sortedUpcoming = [...processList].sort((a, b) => nextRunSeconds(a.cronString) - nextRunSeconds(b.cronString))
	const sortedAll = [...processList].sort((a, b) => String(a.id).localeCompare(String(b.id)))

	const renderMiniList = (items) => {
		if (loading) return <p className="py-4 text-center text-sm text-muted">Loading…</p>
		if (!items.length) return <p className="py-4 text-center text-sm text-muted">No tasks</p>
		return (
			<ul className="divide-y divide-border max-h-56 overflow-y-auto">
				{items.map((item) => (
					<li key={item.id} className="flex items-center gap-3 py-2">
						<ArrowRight className="size-3.5 shrink-0 text-muted" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm text-primary">{item.url}</p>
							<p className="text-xs text-muted">{humanCron(item.cronString)}</p>
						</div>
						{isAdmin && (
							<div className="flex shrink-0 items-center gap-2">
								<Switch
									checked={item.running}
									disabled={busyId === item.id}
									onCheckedChange={() => { setBusyId(item.id); item.running ? stopTask(item.id) : restartTask(item.id) }}
								/>
								{item.id !== "task-auto-cleanup" && (
									<Button variant="ghost" size="icon" className="size-7 text-danger hover:text-danger" onClick={() => deleteTask(item.id)}>
										<Trash2 className="size-3.5" />
									</Button>
								)}
							</div>
						)}
					</li>
				))}
			</ul>
		)
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Scheduled Tasks</CardTitle>
					{withButton && <NavigateToRoute to="/schedule" />}
				</div>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="upcoming">
					<TabsList className="mb-2 w-full">
						<TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
						<TabsTrigger value="all" className="flex-1">All</TabsTrigger>
					</TabsList>
					<TabsContent value="upcoming">{renderMiniList(sortedUpcoming)}</TabsContent>
					<TabsContent value="all">{renderMiniList(sortedAll)}</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	)
}

const ScheduleDashboardFull = ({ mobile = false }) => {
	const role = useRole()
	const isAdmin = role === "admin"
	const [{ processList, loading }, restartTask, stopTask, deleteTask, reloadTasks] = useTasks()
	const [scheduleTask] = useScheduler()
	const [cameras] = useCameras()
	const [{ runs, loading: runsLoading }, refreshRuns] = useTaskRuns()
	const [busyId, setBusyId] = useState(null)
	useEffect(() => { setBusyId(null) }, [processList])

	const [deleteTarget, setDeleteTarget] = useState(null)

	const [outputType, setOutputType] = useState("video")
	const [fps, setFps] = useState(20)
	const [schedCamera, setSchedCamera] = useState(null)
	const [schedPreset, setSchedPreset] = useState(SCHEDULE_PRESETS[1])
	const [schedSkip, setSchedSkip] = useState(1)
	const [schedulerKey, setSchedulerKey] = useState(0)

	const handleSchedule = (url, cronString) => {
		const cam = cameras[schedCamera]
		if (!cam || !schedPreset) return
		const body = {
			camera: String(cam.id),
			hours: schedPreset.hours,
			skip: schedSkip,
			save: true,
			...(outputType === "video" ? { fps } : {})
		}
		scheduleTask(url, JSON.stringify(body), cronString, () => {
			setSchedulerKey(k => k + 1)
			reloadTasks()
		})
	}

	const url = outputType === "video" ? "/convert/createVideo" : "/convert/createZip"

	return (
		<div className="flex flex-col gap-6">
			<Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete task?</DialogTitle>
						<DialogDescription>
							{deleteTarget ? taskSummary(deleteTarget, cameras) : ""}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
						<Button variant="destructive" onClick={() => { deleteTask(deleteTarget.id); setDeleteTarget(null) }}>Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
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
						) : mobile ? (
							<ul className="divide-y divide-border max-h-72 overflow-y-auto">
								{processList.map((task) => (
									<li key={task.id} className="flex items-center gap-3 py-2.5">
										<div className="min-w-0 flex-1">
											<p className="truncate font-mono text-sm text-primary">{task.id}</p>
											<p className="truncate text-xs text-muted">{humanCron(task.cronString)}</p>
											<p className="truncate text-xs text-muted">{taskSummary(task, cameras)}</p>
										</div>
										{isAdmin && (
											<div className="flex shrink-0 items-center gap-2">
												<Switch
													checked={task.running}
													disabled={busyId === task.id}
													onCheckedChange={() => { setBusyId(task.id); task.running ? stopTask(task.id) : restartTask(task.id) }}
												/>
												{!task.protected && (
													<Button variant="ghost" size="icon" className="size-7" onClick={() => setDeleteTarget(task)} title="Destroy">
														<Trash2 className="size-3.5 text-danger" />
													</Button>
												)}
											</div>
										)}
									</li>
								))}
							</ul>
						) : (
							<div className="max-h-72 overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow className="border-border">
											<TableHead className="text-muted text-sm">ID</TableHead>
											<TableHead className="text-muted text-sm">Schedule</TableHead>
											<TableHead className="text-muted text-sm">Task</TableHead>
											{isAdmin && <TableHead className="text-muted text-sm text-right">Actions</TableHead>}
										</TableRow>
									</TableHeader>
									<TableBody>
										{processList.map((task) => (
											<TableRow key={task.id} className="border-border">
												<TableCell className="text-primary font-mono text-sm">{task.id}</TableCell>
												<TableCell className="text-primary text-sm max-w-40 truncate" title={humanCron(task.cronString)}>
													{humanCron(task.cronString)}
												</TableCell>
												<TableCell className="text-muted text-sm max-w-48 truncate" title={taskSummary(task, cameras)}>
													{taskSummary(task, cameras)}
												</TableCell>
												{isAdmin && (
													<TableCell className="text-right">
														<div className="flex justify-end items-center gap-2">
															<Switch
																checked={task.running}
																disabled={busyId === task.id}
																onCheckedChange={() => { setBusyId(task.id); task.running ? stopTask(task.id) : restartTask(task.id) }}
															/>
															{!task.protected && (
																<Button variant="ghost" size="icon" onClick={() => setDeleteTarget(task)} title="Destroy">
																	<Trash2 className="h-4 w-4 text-danger" />
																</Button>
															)}
														</div>
													</TableCell>
												)}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>

				{isAdmin && (
					<Card className={cn("bg-surface border-border", mobile ? "w-full" : "w-full xl:w-96 xl:shrink-0")}>
						<CardHeader>
							<CardTitle className="text-primary">Schedule a Task</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<Label className="text-xs text-muted">Camera</Label>
								<Select value={schedCamera == null ? "" : String(schedCamera)} onValueChange={v => setSchedCamera(parseInt(v))}>
									<SelectTrigger><SelectValue placeholder="Select camera" /></SelectTrigger>
									<SelectContent>
										{cameras.map((cam, i) => (
											<SelectItem key={cam.id} value={String(i)}>{cam.name}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label className="text-xs text-muted">Window</Label>
								<div className="flex gap-1">
									{SCHEDULE_PRESETS.map(p => (
										<Button
											key={p.label}
											variant={schedPreset?.label === p.label ? "default" : "outline"}
											size="sm"
											className="flex-1 px-0"
											onClick={() => setSchedPreset(p)}
										>
											{p.label}
										</Button>
									))}
								</div>
							</div>

							<div className="flex items-center justify-between">
								<Label className="text-xs text-muted">Skip</Label>
								<div className="flex items-center gap-1">
									<Button variant="ghost" size="icon" className="size-7" onClick={() => setSchedSkip(s => Math.max(1, s - 1))}>
										<Minus className="size-3" />
									</Button>
									<Input
										type="number"
										min={1}
										value={schedSkip}
										onChange={e => setSchedSkip(Math.max(1, parseInt(e.target.value) || 1))}
										className="w-12 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									/>
									<Button variant="ghost" size="icon" className="size-7" onClick={() => setSchedSkip(s => s + 1)}>
										<Plus className="size-3" />
									</Button>
								</div>
							</div>

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

							{outputType === "video" && (
								<div className="flex items-center justify-between">
									<Label className="text-xs text-muted">FPS</Label>
									<div className="flex items-center gap-1">
										<Button variant="ghost" size="icon" className="size-7" onClick={() => setFps(f => Math.max(1, f - 5))}>
											<Minus className="size-3" />
										</Button>
										<span className="w-8 text-center text-sm">{fps}</span>
										<Button variant="ghost" size="icon" className="size-7" onClick={() => setFps(f => f + 5)}>
											<Plus className="size-3" />
										</Button>
									</div>
								</div>
							)}

							<Scheduler
								key={schedulerKey}
								url={url}
								onEnter={handleSchedule}
								disabled={schedCamera == null || !cameras[schedCamera]}
							/>
						</CardContent>
					</Card>
				)}
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
					) : mobile ? (
						<ul className="divide-y divide-border max-h-80 overflow-y-auto">
							{runs.map((run) => (
								<li key={run.id} className="flex items-start gap-3 py-2.5">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="truncate font-mono text-sm text-primary">{run.task_id}</p>
											<Badge className={cn("shrink-0 text-xs", run.status === "success" ? "bg-accent text-accent-foreground" : "bg-danger text-white")}>
												{run.status}
											</Badge>
										</div>
										<p className="truncate text-xs text-muted" title={run.url}>{run.url}</p>
										{run.error && <p className="truncate text-xs text-danger" title={run.error}>{run.error}</p>}
									</div>
									<p className="shrink-0 text-xs text-muted" title={run.ran_at}>{moment(run.ran_at).fromNow()}</p>
								</li>
							))}
						</ul>
					) : (
						<div className="max-h-80 overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow className="border-border">
										<TableHead className="text-muted text-sm">Task</TableHead>
										<TableHead className="text-muted text-sm">URL</TableHead>
										<TableHead className="text-muted text-sm">Status</TableHead>
										<TableHead className="text-muted text-sm">HTTP</TableHead>
										<TableHead className="text-muted text-sm">Error</TableHead>
										<TableHead className="text-muted text-sm">When</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{runs.map((run) => (
										<TableRow key={run.id} className="border-border">
											<TableCell className="text-primary font-mono text-sm">{run.task_id}</TableCell>
											<TableCell className="text-muted text-sm max-w-40 truncate" title={run.url}>{run.url}</TableCell>
											<TableCell>
												<Badge className={run.status === "success" ? "bg-accent text-accent-foreground" : "bg-danger text-white"}>
													{run.status}
												</Badge>
											</TableCell>
											<TableCell className="text-muted text-sm">{run.http_status ?? "—"}</TableCell>
											<TableCell className="text-muted text-sm max-w-48 truncate" title={run.error ?? ""}>{run.error ?? "—"}</TableCell>
											<TableCell className="text-muted text-sm" title={run.ran_at}>{moment(run.ran_at).fromNow()}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

const ScheduleDashboard = ({ mobile = false, mini = false, withButton = false }) => {
	if (mini) return <ScheduleDashboardMini withButton={withButton} />
	return <ScheduleDashboardFull mobile={mobile} />
}

export default ScheduleDashboard
