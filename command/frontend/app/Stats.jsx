import React, { useState, useMemo } from "react"
import { Minus, Plus } from "lucide-react"
import { ChevronRight } from "lucide-react"
import useFileStats from "../hooks/useFileStats"
import useStorageUsage from "../hooks/useStorageUsage"
import useClearFootage from "../hooks/useClearFootage"
import useDailyStats from "../hooks/useDailyStats"
import StorageBreakdown from "./StorageBreakdown.jsx"
import { useRole } from "./AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts"
import formatBytes from "../js/formatBytes"
import colors, { CHART_ACCENT, CHART_MUTED } from "../js/colors"
import { cn } from "../lib/utils"
import moment from "moment"

const segmentColor = (i) => i === 0 ? CHART_ACCENT : colors[i % colors.length]

const Stats = () => {
	const role = useRole()
	const isAdmin = role === "admin"

	const [days, setDays] = useState(7)
	const clearLabel = (d) => d === 0 ? "all footage" : `older than ${d} ${d === 1 ? "day" : "days"}`

	const [fileStatsState, , refreshFileStats] = useFileStats({
		loading: "refreshing",
		cameras: [],
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: [],
		hide: {}
	})
	const [dailyStats, refreshDailyStats] = useDailyStats()
	const [usage, refreshUsage] = useStorageUsage()

	const onDone = () => { refreshUsage(); refreshFileStats(); refreshDailyStats() }
	const { days: clearDays, setDays: setClearDays, pending, setPending, deleting, confirmDelete } = useClearFootage(usage.cameras, onDone)

	const { chartData, totalNow, delta } = useMemo(() => {
		const raw = days === 1 ? dailyStats : fileStatsState.fileStats
		if (!raw.length) return { chartData: [], totalNow: 0, delta: 0 }

		const cutoff = (days === 1 ? moment().startOf("day") : moment().subtract(days, "days").startOf("day")).valueOf()
		const filtered = raw.filter(p => p.timestamp >= cutoff)
		if (!filtered.length) return { chartData: [], totalNow: 0, delta: 0 }

		const cameraKeys = Object.keys(filtered[0]).filter(k => k !== "timestamp")

		const byPeriod = {}
		filtered.forEach(point => {
			const period = days === 1
				? moment(point.timestamp).format("YYYY-MM-DD HH:mm")
				: moment(point.timestamp).format("YYYY-MM-DD")
			const total = cameraKeys.reduce((acc, k) => acc + (point[k] || 0), 0)
			byPeriod[period] = (byPeriod[period] || 0) + total
		})

		const chartData = Object.entries(byPeriod)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, total]) => ({ day, total }))

		const totalNow = chartData.reduce((s, p) => s + p.total, 0)
		const delta = chartData.length > 1 ? chartData[chartData.length - 1].total - chartData[0].total : 0

		return { chartData, totalNow, delta }
	}, [fileStatsState.fileStats, dailyStats, days])

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9
	const sortedCameras = [...usage.cameras].sort((a, b) => b.used_gb - a.used_gb)
	const camColor = new Map(sortedCameras.map((c, i) => [c.id, segmentColor(i)]))
	const totalCamGb = usage.cameras.reduce((s, c) => s + Math.max(c.used_gb, 0.001), 0) || 1
	const maxCamGb = Math.max(...usage.cameras.map(c => c.used_gb), 0.001)

	return (
		<div className="mx-auto max-w-5xl space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
			<div className="space-y-4">
				<Card>
					<CardContent className="space-y-3 pt-4">
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-muted w-14 shrink-0">by camera</span>
							<div className="flex h-3 flex-1 overflow-hidden rounded-full">
								{usage.cameras.length > 0
									? usage.cameras.map((cam) => (
										<div key={cam.id} style={{ flex: `0 0 ${(Math.max(cam.used_gb, 0.001) / totalCamGb * 100).toFixed(3)}%`, backgroundColor: camColor.get(cam.id) }} />
									))
									: <div className="flex-1 rounded-full bg-border" />
								}
							</div>
						</div>
						{usage.max_gb > 0 && (
							<div className="flex items-center gap-2">
								<span className="text-[10px] text-muted w-14 shrink-0">vs max</span>
								<div className="flex h-3 flex-1 overflow-hidden rounded-full bg-border">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${Math.min(100, (usage.used_gb / usage.max_gb) * 100)}%` }}
									/>
								</div>
							</div>
						)}
						<p className="text-sm text-muted">
							{usage.max_gb > 0
								? `${formatBytes(usedBytes, 1)} / ${formatBytes(maxBytes, 1)} USED`
								: `${formatBytes(usedBytes, 1)} USED`
							}
							{` • ${usage.total_frames.toLocaleString()} frames`}
						</p>
						<StorageBreakdown breakdown={usage.breakdown} />
					</CardContent>
				</Card>

				<div className="flex justify-center">
					<div className="flex rounded-full border border-border bg-surface-raised p-0.5">
						{[1, 7, 30].map(d => (
							<button
								key={d}
								onClick={() => setDays(d)}
								className={cn(
									"rounded-full px-5 py-1.5 text-sm font-medium transition-colors",
									days === d ? "bg-accent text-accent-foreground" : "text-muted hover:text-primary"
								)}
							>
								{d === 1 ? "1 Day" : `${d} Days`}
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
								Total recorded {days === 1 ? "today" : days === 7 ? "this week" : "this month"}
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
								<AreaChart key={`${days}-${chartData.length}`} data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
									<defs>
										<linearGradient id="storageGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor={CHART_ACCENT} stopOpacity={0.3} />
											<stop offset="95%" stopColor={CHART_ACCENT} stopOpacity={0} />
										</linearGradient>
										<clipPath id="storageReveal">
											<rect x="0" y="0" height="100%" width="0">
												<animate attributeName="width" from="0" to="100%" dur="0.8s" fill="freeze" />
											</rect>
										</clipPath>
									</defs>
									<XAxis
										dataKey="day"
										tickFormatter={d => days === 1 ? moment(d, "YYYY-MM-DD HH:mm").format("h:mma") : moment(d).format("ddd")}
										tick={{ fill: CHART_MUTED, fontSize: 11 }}
										axisLine={false}
										tickLine={false}
										interval="preserveStartEnd"
									/>
									<Area
										type="monotone"
										dataKey="total"
										stroke={CHART_ACCENT}
										fill="url(#storageGrad)"
										strokeWidth={2}
										dot={false}
										isAnimationActive={false}
										clipPath="url(#storageReveal)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

			</div>

			<div className="space-y-4">
				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-base text-accent">By Camera</CardTitle>
							{isAdmin && (
								<div className="flex items-center gap-1">
									<span className="text-xs text-muted mr-1">Older than</span>
									<Button variant="outline" size="icon" className="size-7"
										onClick={() => setClearDays(d => Math.max(0, d - 1))}>
										<Minus className="size-3" />
									</Button>
									<span className="w-14 text-center text-xs font-medium">
										{clearDays === 0 ? "all" : `${clearDays} ${clearDays === 1 ? "day" : "days"}`}
									</span>
									<Button variant="outline" size="icon" className="size-7"
										onClick={() => setClearDays(d => d + 1)}>
										<Plus className="size-3" />
									</Button>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent className="p-0 pb-2">
						<div className="flex flex-col divide-y divide-border overflow-y-auto max-h-96">
							{sortedCameras.map((cam) => (
								<div key={cam.id} className="flex flex-col gap-1.5 px-4 py-3">
									<div className="flex items-center gap-3">
										<div className="size-3 rounded-full shrink-0" style={{ backgroundColor: camColor.get(cam.id) }} />
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
									<div className="ml-[22px] h-1.5 overflow-hidden rounded-full bg-border">
										<div
											className="h-full rounded-full transition-all"
											style={{ width: `${((cam.used_gb / maxCamGb) * 100).toFixed(1)}%`, backgroundColor: camColor.get(cam.id) }}
										/>
									</div>
								</div>
							))}
						</div>
						{isAdmin && sortedCameras.length > 0 && (
							<div className="px-4 pt-3 pb-1">
								<Button
									className="w-full bg-accent text-accent-foreground hover:opacity-90"
									disabled={deleting}
									onClick={() => setPending({ type: "all" })}
								>
								Clear All — {clearLabel(clearDays)}
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Clear</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">
						{pending?.type === "all"
							? `Delete ${clearLabel(clearDays)} from all cameras?`
							: `Delete ${clearLabel(clearDays)} from ${pending?.cameraName}?`
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
