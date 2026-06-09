import React, { useState } from "react"
import useProcesses from "../hooks/useProcesses"
import { useRole } from "./AuthContext"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Download, XCircle, Trash2 } from "lucide-react"
import { cn } from "../lib/utils"
import moment from "moment"

const RecordingsList = () => {
	const [state, cancelProcess, deleteProcess] = useProcesses()
	const role = useRole()
	const [confirm, setConfirm] = useState(null)

	const handleAction = () => {
		if (!confirm) return
		if (confirm.running) cancelProcess(confirm.id)
		else deleteProcess(confirm.id)
		setConfirm(null)
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-semibold">recordings</h1>
			<p className="text-sm text-muted -mt-2">Generated frames &amp; clips from the clip maker.</p>

			{state.loading && (
				<p className="text-center text-sm text-muted py-8">Loading…</p>
			)}
			{!state.loading && state.processList.length === 0 && (
				<p className="text-center text-sm text-muted py-8">No recordings yet</p>
			)}

			{state.processList.map((process) => {
				const startTime = moment(process.start, "YYYYMMDD-HHmmss")
				const endTime = moment(process.end, "YYYYMMDD-HHmmss")
				const dateLabel = startTime.format("MMM D, YYYY")
				const timeRange = `${startTime.format("h:mm A")} – ${endTime.format("h:mm A")}`
				return (
					<div key={process.id} className="rounded-xl border border-border bg-surface p-4 flex gap-3">
						<div className="size-14 rounded-lg bg-surface-raised shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="flex items-start justify-between gap-2">
								<p className="font-medium text-sm text-primary">Camera {process.camera}</p>
								{process.running
									? <Badge className="text-xs bg-amber-500/15 text-amber-400 border-none">Generating</Badge>
									: <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-none">Ready</Badge>
								}
							</div>
							<p className="text-xs text-muted mt-0.5">{dateLabel}</p>
							<p className="text-xs text-muted">{timeRange}</p>
							<div className="flex gap-2 mt-3">
								<Button variant="outline" size="sm" disabled={process.running} asChild>
									<a href={process.link} download>
										<Download className="size-3.5 mr-1" />
										Download
									</a>
								</Button>
								{role === "admin" && (
									<Button
										variant="outline"
										size="sm"
										className={cn(
											process.running
												? "text-muted border-muted"
												: "text-danger border-danger hover:bg-danger/10"
										)}
										onClick={() => setConfirm(process)}
									>
										{process.running
											? <><XCircle className="size-3.5 mr-1" />Cancel</>
											: <><Trash2 className="size-3.5 mr-1" />Delete</>
										}
									</Button>
								)}
							</div>
						</div>
					</div>
				)
			})}

			<Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
				<DialogContent className="max-w-xs">
					<DialogHeader>
						<DialogTitle>{confirm?.running ? "Cancel" : "Delete"} recording?</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">This action cannot be undone.</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirm(null)}>No</Button>
						<Button className="bg-danger text-accent-foreground hover:bg-danger/80" onClick={handleAction}>Yes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default RecordingsList
