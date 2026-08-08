import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import useProcesses from "../hooks/useProcesses.js"
import { useRole } from "./AuthContext.jsx"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter
} from "../components/ui/dialog"
import { XCircle, Trash2, Download } from "lucide-react"
import { cn } from "../lib/utils"
import NavigateToRoute from "./NavigateToRoute"

import moment from "moment"

const ProcessList = (props) => {
	const { t } = useTranslation()
	const [state, cancelProcess, deleteProcess] = useProcesses()
	const role = useRole()

	const [confirmDialog, setConfirmDialog] = useState({ open: false, process: null })

	const handleConfirm = () => {
		const p = confirmDialog.process
		if (!p) return
		if (p.running) cancelProcess(p.id)
		else deleteProcess(p.id)
		setConfirmDialog({ open: false, process: null })
	}

	const typeLabel = (type) =>
		type === "mp4" ? t("status.video") : type === "zip" ? t("status.zip") : type ?? t("status.unknownType")

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">{t("status.processes")}</CardTitle>
					{props.mini && <NavigateToRoute to="/recordings" />}
				</div>
			</CardHeader>
			<CardContent className={cn("flex flex-col gap-2", props.mini && "max-h-64 overflow-y-auto")}>
				{state.loading && (
					<p className="py-4 text-center text-sm text-muted">{t("common.loading")}</p>
				)}
				{!state.loading && state.processList.length === 0 && (
					<p className="py-4 text-center text-sm text-muted">{t("status.noProcesses")}</p>
				)}
				{state.processList.map((process) => {
					const requestedTime = moment.utc(process.requested, "YYYYMMDD-HHmmss").local().format("LLL")
					const startTime = moment.utc(process.start, "YYYYMMDD-HHmmss").local().format("LLL")
					const endTime = moment.utc(process.end, "YYYYMMDD-HHmmss").local().format("LLL")
					return (
						<div key={process.id} className="rounded-md border border-border bg-surface p-3 flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium text-primary">
									{typeLabel(process.type)} &mdash; {requestedTime}
								</span>
								{process.running && (
									<Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500">
										{t("status.running")}
									</Badge>
								)}
							</div>
							<div className="flex flex-col gap-0.5 text-xs text-muted">
								<span>{t("status.cameraLabel", { camera: process.camera })}</span>
								<span>{t("status.startLabel", { time: startTime })}</span>
								<span>{t("status.endLabel", { time: endTime })}</span>
							</div>
							{!props.mini && !props.mobile && !process.running && process.type === "mp4" && (
								<video src={process.link ? new URL(process.link, window.location.origin).pathname : undefined} type="video/mp4" controls className="w-32 rounded" />
							)}
							<div className="flex gap-2">
								{process.running ? (
									<Button variant="outline" size="sm" disabled>
										<Download className="mr-1.5 size-3.5" />
										{t("status.download")}
									</Button>
								) : (
									<Button variant="outline" size="sm" asChild>
										<a href={process.link} download>
											<Download className="mr-1.5 size-3.5" />
											{t("status.download")}
										</a>
									</Button>
								)}
								{role === "admin" && (
									<Button
										variant="outline"
										size="sm"
										className="text-danger border-danger hover:bg-danger hover:text-accent-foreground"
										onClick={() => setConfirmDialog({ open: true, process })}
									>
										{process.running
											? <><XCircle className="mr-1.5 size-3.5" />{t("common.cancel")}</>
											: <><Trash2 className="mr-1.5 size-3.5" />{t("common.delete")}</>
										}
									</Button>
								)}
							</div>
						</div>
					)
				})}
			</CardContent>

			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) => !open && setConfirmDialog({ open: false, process: null })}
			>
				<DialogContent className="max-w-xs">
					<DialogHeader>
						<DialogTitle>
							{confirmDialog.process?.running ? t("status.cancelProcess") : t("status.deleteProcess")}
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted">{t("status.cannotUndo")}</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmDialog({ open: false, process: null })}>
							{t("status.no")}
						</Button>
						<Button
							className="bg-danger text-accent-foreground hover:bg-danger/80"
							onClick={handleConfirm}
						>
							{t("status.yes")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}

export default ProcessList
