import React, { useState, useMemo } from "react"
import { Minus, Plus } from "lucide-react"
import { ChevronRight } from "lucide-react"
import useFileStats from "../hooks/useFileStats"
import useStorageUsage from "../hooks/useStorageUsage"
import { useRole } from "./AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts"
import formatBytes from "../js/formatBytes"
import colors from "../js/colors"
import { cn } from "../lib/utils"
import { request, jsonProcessing } from "../js/request"
import moment from "moment"

const ACCENT = "#C97B3A"
const MUTED = "#9A7A6A"
const segmentColor = (i) => i === 0 ? ACCENT : colors[i % colors.length]

const Stats = () => {
	const role = useRole()
	const isAdmin = role === "admin"

	const [days, setDays] = useState(7)
	const [clearDays, setClearDays] = useState(3)
	const [pending, setPending] = useState(null)
	const [deleting, setDeleting] = useState(false)

	const [fileStatsState] = useFileStats({
		loading: "refreshing",
		cameras: [],
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: [],
		hide: {}
	})
	const [usage, refreshUsage] = useStorageUsage()

	const { chartData, totalNow, delta } = useMemo(() => {
		const stats = fileStatsState.fileStats
		if (!stats.length) return { chartData: [], totalNow: 0, delta: 0 }

		const cutoff = moment().subtract(days, "days").startOf("day").valueOf()
		const filtered = stats.filter(p => p.timestamp >= cutoff)
		if (!filtered.length) return { chartData: [], totalNow: 0, delta: 0 }

		const cameraKeys = Object.keys(filtered[0]).filter(k => k !== "timestamp")

		const byDay = {}
		filtered.forEach(point => {
			const day = moment(point.timestamp).format("YYYY-MM-DD")
			const total = cameraKeys.reduce((acc, k) => acc + (point[k] || 0), 0)
			byDay[day] = total
		})

		const chartData = Object.entries(byDay)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, total]) => ({ day, total }))

		const totalNow = chartData[chartData.length - 1].total
		const delta = chartData.length > 1 ? totalNow - chartData[0].total : 0

		return { chartData, totalNow, delta }
	}, [fileStatsState.fileStats, days])

	const confirmDelete = () => {
		if (!pending) return
		setDeleting(true)
		setPending(null)
		const done = () => { setDeleting(false); refreshUsage() }
		if (pending.type === "all") {
			Promise.all(usage.cameras.map(cam => new Promise(resolve => {
				request("/file/pathClean", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ camera: cam.id, days: clearDays })
				}, prom => jsonProcessing(prom, resolve))
			}))).then(done)
		} else {
			request("/file/pathClean", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ camera: pending.cameraId, days: clearDays })
			}, prom => jsonProcessing(prom, done))
		}
	}

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9
	const sortedCameras = [...usage.cameras].sort((a, b) => b.used_gb - a.used_gb)

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="space-y-3 pt-4">
					<div className="flex h-3 w-full overflow-hidden rounded-full">
						{usage.cameras.length > 0
							? usage.cameras.map((cam, i) => (
								<div key={cam.id} style={{ flex: cam.used_gb || 0.001, backgroundColor: segmentColor(i) }} />
							))
							: <div className="flex-1 rounded-full bg-muted" />
						}
					</div>
					{usage.max_gb > 0 && (
						<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${Math.min(100, (usage.used_gb / usage.max_gb) * 100)}%` }}
							/>
						</div>
					)}
					<p className="text-sm text-muted">
						{usage.max_gb > 0
							? `${formatBytes(usedBytes, 1)} / ${formatBytes(maxBytes, 1)} USED`
							: `${formatBytes(usedBytes, 1)} USED`
						}
						{` • ${usage.total_frames.toLocaleString()} frames`}
					</p>
				</CardContent>
			</Card>

			<div className="flex justify-center">
				<div className="flex rounded-full border border-border bg-surface-raised p-0.5">
					{[7, 30].map(d => (
						<button
							key={d}
							onClick={() => setDays(d)}
							className={cn(
								"rounded-full px-5 py-1.5 text-sm font-medium transition-colors",
								days === d ? "bg-accent text-accent-foreground" : "text-muted hover:text-primary"
							)}
						>
							{d} Days
						</button>
					))}
				</div>
			</div>

			<Card>
				<CardContent className="pt-4">
					<div className="flex items-start justify-between mb-3">
						<div>
							<p className="text-base font-semibold text-accent">Storage Growth</p>
							<p className="text-xs text-muted mt-0.5">
								Total recorded {days === 7 ? "this week" : "this month"}
							</p>
						</div>
						<div className="text-right">
							<p className="text-2xl font-bold">{formatBytes(totalNow, 1)}</p>
							{delta !== 0 && (
								<p className={cn("text-xs font-medium", delta > 0 ? "text-green-500" : "text-red-500")}>
									{delta > 0 ? "+" : ""}{formatBytes(Math.abs(delta), 1)} {delta > 0 ? "↑" : "↓"}
								</p>
							)}
						</div>
					</div>
					<div className="h-32">
						<ResponsiveContainer>
							<AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
								<defs>
									<linearGradient id="storageGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
										<stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
									</linearGradient>
								</defs>
								<XAxis
									dataKey="day"
									tickFormatter={d => moment(d).format("ddd")}
									tick={{ fill: MUTED, fontSize: 11 }}
									axisLine={false}
									tickLine={false}
									interval="preserveStartEnd"
								/>
								<Area
									type="monotone"
									dataKey="total"
									stroke={ACCENT}
									fill="url(#storageGrad)"
									strokeWidth={2}
									dot={false}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base text-accent">By Camera</CardTitle>
						{isAdmin && (
							<div className="flex items-center gap-1">
								<span className="text-xs text-muted mr-1">Older than</span>
								<Button variant="outline" size="icon" className="size-7"
									onClick={() => setClearDays(d => Math.max(1, d - 1))}>
									<Minus className="size-3" />
								</Button>
								<span className="w-14 text-center text-xs font-medium">
									{clearDays} {clearDays === 1 ? "day" : "days"}
								</span>
								<Button variant="outline" size="icon" className="size-7"
									onClick={() => setClearDays(d => d + 1)}>
									<Plus className="size-3" />
								</Button>
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col divide-y divide-border p-0 pb-2">
					{sortedCameras.map((cam, i) => (
						<div key={cam.id} className="flex items-center gap-3 px-4 py-3">
							<div className="size-3 rounded-full shrink-0" style={{ backgroundColor: segmentColor(i) }} />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">{cam.name}</p>
							</div>
							<p className="text-sm font-semibold">
								{formatBytes(cam.used_gb * 1e9, 1)}
							</p>
							{isAdmin ? (
								<Button
									variant="outline"
									size="sm"
									className="text-danger border-danger hover:bg-danger/10 shrink-0 ml-2"
									disabled={deleting}
									onClick={() => setPending({ type: "camera", cameraId: cam.id, cameraName: cam.name })}
								>
									Clear
								</Button>
							) : (
								<ChevronRight className="size-4 text-muted shrink-0 ml-1" />
							)}
						</div>
					))}
					{isAdmin && sortedCameras.length > 0 && (
						<div className="px-4 pt-3 pb-1">
							<Button
								className="w-full bg-accent text-accent-foreground hover:opacity-90"
								disabled={deleting}
								onClick={() => setPending({ type: "all" })}
							>
								Clear All — older than {clearDays} {clearDays === 1 ? "day" : "days"}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Clear</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">
						{pending?.type === "all"
							? `Delete footage older than ${clearDays} ${clearDays === 1 ? "day" : "days"} from all cameras?`
							: `Delete footage older than ${clearDays} ${clearDays === 1 ? "day" : "days"} from ${pending?.cameraName}?`
						}
					</p>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
						<Button variant="destructive" onClick={confirmDelete}>Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default Stats
