import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import useProcesses from "../hooks/useProcesses"
import { useRole } from "./AuthContext"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Download, XCircle, Trash2 } from "lucide-react"
import { cn } from "../lib/utils"
import NavigateToRoute from "./NavigateToRoute"
import formatBytes from "../js/formatBytes.js"
import moment from "moment"

const RecordingsList = ({ mini } = {}) => {
	const { t } = useTranslation()
	const [state, cancelProcess, deleteProcess] = useProcesses()
	const role = useRole()
	const [confirm, setConfirm] = useState(null)

	const handleAction = () => {
		if (!confirm) return
		if (confirm.running) cancelProcess(confirm.id)
		else deleteProcess(confirm.id)
		setConfirm(null)
	}

	if (mini) {
		return (
			<Card className="h-full flex flex-col overflow-hidden">
				<CardHeader className="pb-2 shrink-0">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">{t("recordings.title")}</CardTitle>
						<NavigateToRoute to="/recordings" />
					</div>
				</CardHeader>
				<CardContent className="p-3 pt-0 overflow-y-auto flex-1">
					{state.loading && <p className="text-center text-sm text-muted py-4">{t("common.loading")}</p>}
					{!state.loading && state.processList.length === 0 && (
						<p className="text-center text-sm text-muted py-4">{t("recordings.noRecordings")}</p>
					)}
					<ul className="divide-y divide-border">
						{state.processList.map(process => {
							const startTime = moment.utc(process.start, "YYYYMMDD-HHmmss").local()
							return (
								<li key={process.id} className="flex items-center justify-between py-2 gap-2">
									<div className="min-w-0 flex-1">
										<p className="text-sm text-primary truncate">{t("recordings.camLabel", { camera: process.camera })} · {startTime.format("MMM D")}</p>
										<p className="text-xs text-muted uppercase">{process.type}{process.size != null && ` · ${formatBytes(process.size, 1)}`}</p>
									</div>
									{process.running
										? <Badge className="text-xs bg-amber-500/15 text-amber-400 border-none shrink-0">{t("recordings.generating")}</Badge>
										: <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-none shrink-0">{t("recordings.ready")}</Badge>
									}
								</li>
							)
						})}
					</ul>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-semibold">{t("recordings.heading")}</h1>
			<p className="text-sm text-muted -mt-2">{t("recordings.subtitle")}</p>

			{state.loading && (
				<p className="text-center text-sm text-muted py-8">{t("common.loading")}</p>
			)}
			{!state.loading && state.processList.length === 0 && (
				<p className="text-center text-sm text-muted py-8">{t("recordings.noRecordingsYet")}</p>
			)}

			{state.processList.map((process) => {
				const startTime = moment.utc(process.start, "YYYYMMDD-HHmmss").local()
				const endTime = moment.utc(process.end, "YYYYMMDD-HHmmss").local()
				const dateLabel = startTime.format("MMM D, YYYY")
				const timeRange = `${startTime.format("h:mm A")} – ${endTime.format("h:mm A")}`
				return (
					<div key={process.id} className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
						<div className="flex flex-col sm:flex-row gap-3">
							{!process.running && process.type === "mp4"
								? <video src={process.link ? new URL(process.link, window.location.origin).pathname : undefined} controls playsInline className="w-full sm:w-48 md:w-64 aspect-video rounded-lg shrink-0" />
								: <div className="size-14 rounded-lg bg-surface-raised shrink-0" />
							}
							<div className="flex-1 min-w-0">
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-2">
										<p className="font-medium text-sm text-primary">{t("recordings.camera", { camera: process.camera })}</p>
										<Badge className="text-xs bg-surface-raised text-muted border-none uppercase">{process.type}</Badge>
										{process.size != null && (
											<span className="text-xs text-muted">{formatBytes(process.size, 1)}</span>
										)}
									</div>
									{process.running
										? <Badge className="text-xs bg-amber-500/15 text-amber-400 border-none">{t("recordings.generating")}</Badge>
										: <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-none">{t("recordings.ready")}</Badge>
									}
								</div>
								<p className="text-xs text-muted mt-0.5">{dateLabel}</p>
								<p className="text-xs text-muted">{timeRange}</p>
								<div className="flex gap-2 mt-3">
									{process.running ? (
										<Button variant="outline" size="sm" disabled>
											<Download className="size-3.5 mr-1" />
											{t("recordings.download")}
										</Button>
									) : (
										<Button variant="outline" size="sm" asChild>
											<a href={process.link} download>
												<Download className="size-3.5 mr-1" />
												{t("recordings.download")}
											</a>
										</Button>
									)}
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
												? <><XCircle className="size-3.5 mr-1" />{t("common.cancel")}</>
												: <><Trash2 className="size-3.5 mr-1" />{t("common.delete")}</>
											}
										</Button>
									)}
								</div>
							</div>
						</div>
					</div>
				)
			})}

			<Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
				<DialogContent className="max-w-xs">
					<DialogHeader>
						<DialogTitle>{t("recordings.confirmTitle", { action: confirm?.running ? t("common.cancel") : t("common.delete") })}</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">{t("recordings.cannotBeUndone")}</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirm(null)}>{t("recordings.no")}</Button>
						<Button className="bg-danger text-accent-foreground hover:bg-danger/80" onClick={handleAction}>{t("recordings.yes")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default RecordingsList
