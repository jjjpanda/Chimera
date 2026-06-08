import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import useStorageUsage from "../hooks/useStorageUsage.js"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog"
import formatBytes from "../js/formatBytes.js"
import colors from "../js/colors.js"
import { request, jsonProcessing } from "../js/request.js"

const ACCENT = "#C97B3A"
const segmentColor = (i) => i === 0 ? ACCENT : colors[i % colors.length]

const today = new Date().toISOString().split("T")[0]

const DataManager = () => {
	const navigate = useNavigate()
	const [usage, refresh] = useStorageUsage()

	const [cutoffDate, setCutoffDate] = useState("")
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
			const days = Math.ceil((Date.now() - new Date(cutoffDate).getTime()) / 86400000)
			Promise.all(usage.cameras.map(cam => new Promise(resolve => {
				request("/file/pathClean", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ camera: cam.id, days })
				}, prom => jsonProcessing(prom, resolve))
			}))).then(done)
		} else {
			request(`/camera/${pending.cameraId}`, { method: "DELETE" }, prom => jsonProcessing(prom, done))
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
					<CardTitle className="text-base">Clear Before Date</CardTitle>
					<p className="text-xs text-muted">Delete footage from all cameras recorded before the selected date.</p>
				</CardHeader>
				<CardContent className="space-y-3">
					<Input
						type="date"
						max={today}
						value={cutoffDate}
						onChange={e => setCutoffDate(e.target.value)}
						className="w-full"
					/>
					<div className="flex justify-end">
						<Button
							variant="destructive"
							disabled={!cutoffDate || deleting}
							onClick={() => setPending({ type: "all" })}
						>
							Delete Frame Data
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Clear by Camera</CardTitle>
					<p className="text-xs text-muted">Delete all footage from a specific camera.</p>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{usage.cameras.map((cam, i) => (
							<div key={cam.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
								<div className="h-2 w-full rounded-full" style={{ backgroundColor: segmentColor(i) }} />
								<p className="text-sm font-medium">{cam.name}</p>
								<p className="text-xs text-muted">{formatBytes(cam.used_gb * 1e9, 1)}</p>
								<Button
									variant="destructive"
									size="sm"
									disabled={deleting}
									onClick={() => setPending({ type: "camera", cameraId: cam.id, cameraName: cam.name })}
								>
									Delete
								</Button>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Dialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Delete</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">
						{pending?.type === "all"
							? `Delete all footage from all cameras recorded before ${cutoffDate}?`
							: `Delete all footage from ${pending?.cameraName}?`
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
