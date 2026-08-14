import React, { useState, useEffect } from "react"
import moment from "moment"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { request, authPromiseHandler } from "../js/request.js"
import toast from "../js/toast.js"
import errorMessage from "../js/errors.js"

const IDLE_POLL_MS = 30000
const BUSY_POLL_MS = 5000

const SystemUpdate = () => {
	const { t } = useTranslation()
	const [status, setStatus] = useState(null)
	const [open, setOpen] = useState(false)
	const [confirmedMajor, setConfirmedMajor] = useState(false)

	const fetchStatus = () => request("/system/update", { method: "GET" }, authPromiseHandler)
		.then(data => { if (!data.error) setStatus(data) })

	const state = status?.state ?? "idle"
	const busy = state !== "idle"
	const watchdogOff = status?.watchdogEnabled === false
	const version = status?.version
	const bump = version?.bump
	const major = bump === "major"

	useEffect(() => { fetchStatus() }, [])

	useEffect(() => {
		const id = setInterval(fetchStatus, busy ? BUSY_POLL_MS : IDLE_POLL_MS)
		return () => clearInterval(id)
	}, [busy])

	const requestUpdate = () => {
		request("/system/update", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ allowMajor: major && confirmedMajor })
		}, authPromiseHandler).then(res => {
			if (res.error) toast(errorMessage(res.errors) || t("admin.update.failed"))
			else toast(t("admin.update.requested"))
			setOpen(false)
			setConfirmedMajor(false)
			fetchStatus()
		})
	}

	const last = status?.last

	return (
		<Card className="bg-surface border-border mt-4">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-primary text-lg">{t("admin.update.title")}</CardTitle>
				<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmedMajor(false) }}>
					<DialogTrigger asChild>
						<Button size="sm" disabled={busy || watchdogOff} className="bg-accent text-accent-foreground hover:bg-accent/80">{t("admin.update.button")}</Button>
					</DialogTrigger>
					<DialogContent className="bg-surface-raised border-border text-primary">
						<DialogHeader>
							<DialogTitle className="text-primary">{t("admin.update.title")}</DialogTitle>
							<DialogDescription className="text-muted">{t("admin.update.confirm")}</DialogDescription>
						</DialogHeader>
						{bump === "minor" && (
							<p className="text-sm text-muted">{t("admin.update.minorNotice", { from: version.current, to: version.available })}</p>
						)}
						{major && (
							<label className="flex items-start gap-2 text-sm text-danger">
								<input type="checkbox" checked={confirmedMajor} onChange={(e) => setConfirmedMajor(e.target.checked)} className="mt-1" />
								<span>{t("admin.update.majorConfirm", { from: version.current, to: version.available })}</span>
							</label>
						)}
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="ghost" className="text-muted hover:text-primary">{t("common.cancel")}</Button>
							</DialogClose>
							<Button onClick={requestUpdate} disabled={major && !confirmedMajor} className="bg-accent text-accent-foreground hover:bg-accent/80">{t("admin.update.button")}</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<p className="text-sm text-muted">{t("admin.update.description")}</p>
				{watchdogOff && <p className="text-sm text-danger">{t("admin.update.watchdogOff")}</p>}
				{version && bump && (
					<p className={`text-sm ${major ? "text-danger" : "text-muted"}`}>
						{bump === "none"
							? t("admin.update.versionCurrent", { current: version.current })
							: t(major ? "admin.update.versionMajor" : "admin.update.versionAvailable", { from: version.current, to: version.available })}
					</p>
				)}
				{state === "pending" && (
					<p className="text-sm text-primary">{t("admin.update.pending", { username: status.requestedBy })}</p>
				)}
				{state === "running" && <p className="text-sm text-primary">{t("admin.update.running")}</p>}
				{last && (
					<p className={`text-sm ${last.success ? "text-muted" : "text-danger"}`}>
						{last.success
							? t("admin.update.lastSuccess", { when: moment(last.at).fromNow() })
							: last.blocked
								? t("admin.update.lastBlocked", { when: moment(last.at).fromNow(), from: last.from, to: last.to })
								: t("admin.update.lastFailure", { when: moment(last.at).fromNow(), message: last.message })}
					</p>
				)}
			</CardContent>
		</Card>
	)
}

export default SystemUpdate
