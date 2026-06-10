import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Minus, Plus } from "lucide-react"
import useStorageUsage from "../hooks/useStorageUsage.js"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog"
import formatBytes from "../js/formatBytes.js"
import colors from "../js/colors.js"
import { request, jsonProcessing } from "../js/request.js"

const ACCENT = "#C97B3A"
const segmentColor = (i) => i === 0 ? ACCENT : colors[i % colors.length]

const DataManager = () => {
	const navigate = useNavigate()
	const [usage, refresh] = useStorageUsage()

	const [days, setDays] = useState(3)
	const daysLabel = (d) => d === 0 ? "all footage" : `older than ${d} ${d === 1 ? "day" : "days"}`
	const [pending, setPending] = useState(null)
	const [deleting, setDeleting] = useState(false)

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9

	const confirmDelete = () => {
		if (!pending) return
		setDeleting(true)
		setPending(null)

		const done = () => { setDeleting(false); refresh() }

		if (pending.type === "all") {
			Promise.all(usage.cameras.map(cam => new Promise(resolve => {
				request("/file/pathClean", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ camera: cam.id, days })
				}, prom => jsonProcessing(prom, resolve))
			}))).then(done)
		} else {
			request("/file/pathClean", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ camera: pending.cameraId, days })
			}, prom => jsonProcessing(prom, done))
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<button onClick={() => navigate(-1)} className="text-muted transition-colors hover:text-primary">
					<ArrowLeft className="size-5" />
				</button>
				<h1 className="text-lg font-semibold">Data Manager</h1>
			</div>

			<Card>
				<CardContent className="space-y-3 pt-4">
					<div className="flex items-center gap-2">
						<span className="text-[10px] text-muted w-14 shrink-0">by camera</span>
						<div className="flex h-3 flex-1 overflow-hidden rounded-full">
							{usage.cameras.length > 0
								? usage.cameras.map((cam, i) => (
									<div key={cam.id} style={{ flex: cam.used_gb || 0.001, backgroundColor: segmentColor(i) }} />
								))
								: <div className="flex-1 rounded-full bg-muted" />
							}
						</div>
					</div>
					{usage.max_gb > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-muted w-14 shrink-0">vs max</span>
							<div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{ width: `${Math.min(100, (usage.used_gb / usage.max_gb) * 100)}%` }}
								/>
							</div>
						</div>
					)}
					<div className="flex flex-wrap gap-x-3 gap-y-1">
						{usage.cameras.map((cam, i) => (
							<span key={cam.id} className="flex items-center gap-1 text-xs text-muted">
								<span className="inline-block size-2 rounded-full" style={{ backgroundColor: segmentColor(i) }} />
								{cam.name}
							</span>
						))}
					</div>
					<p className="text-sm text-muted">
						{usage.max_gb > 0
							? `${formatBytes(usedBytes, 1)} / ${formatBytes(maxBytes, 1)} USED`
							: `${formatBytes(usedBytes, 1)} USED`
						}
						{` • ${usage.total_frames.toLocaleString()} frames`}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Clear Old Footage</CardTitle>
					<p className="text-xs text-muted">Delete frames older than a set age, per camera.</p>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center gap-1">
						<span className="text-sm text-muted mr-2">Older than</span>
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => setDays(d => Math.max(0, d - 1))}
						>
							<Minus className="size-3.5" />
						</Button>
						<span className="w-16 text-center text-sm font-medium">{days === 0 ? "all" : `${days} ${days === 1 ? "day" : "days"}`}</span>
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => setDays(d => d + 1)}
						>
							<Plus className="size-3.5" />
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">By Camera</CardTitle>
					<p className="text-xs text-muted">{daysLabel(days)}</p>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{usage.cameras.map((cam, i) => (
						<div key={cam.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
							<div className="size-2 rounded-full shrink-0" style={{ backgroundColor: segmentColor(i) }} />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">{cam.name}</p>
								<p className="text-xs text-muted">{formatBytes(cam.used_gb * 1e9, 1)} clearable</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="text-danger border-danger hover:bg-danger/10 shrink-0"
								disabled={deleting}
								onClick={() => setPending({ type: "camera", cameraId: cam.id, cameraName: cam.name })}
							>
								Clear
							</Button>
						</div>
					))}
					<Button
						className="w-full mt-2 bg-accent text-accent-foreground hover:opacity-90"
						disabled={deleting}
						onClick={() => setPending({ type: "all" })}
					>
						Clear All Cameras — {daysLabel(days)}
					</Button>
				</CardContent>
			</Card>

			<Dialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Clear</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">
						{pending?.type === "all"
							? `Delete ${daysLabel(days)} from all cameras?`
							: `Delete ${daysLabel(days)} from ${pending?.cameraName}?`
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

export default DataManager
