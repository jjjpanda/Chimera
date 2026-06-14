import React, { useState, useEffect } from "react"
import moment from "moment"
import useChimeraStatus from "../hooks/useChimeraStatus"
import useCameras from "../hooks/useCameras.js"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { cn } from "../lib/utils"
import NavigateToRoute from "./NavigateToRoute.jsx"

const StatusDot = ({ status }) => (
	<span className={cn(
		"inline-block size-2 rounded-full shrink-0",
		status === "up" && "bg-emerald-500",
		status === "down" && "bg-danger",
		(!status || status === "loading") && "bg-muted animate-pulse"
	)} />
)

const services = ["command", "schedule", "storage", "motion", "database", "livestream", "memory"]

const Status = ({ withUsers = false }) => {
	const [status] = useChimeraStatus()
	const [cameras] = useCameras()
	const [users, setUsers] = useState([])

	useEffect(() => {
		if (!withUsers) return
		fetch("/authorization/users")
			.then(r => r.json())
			.then(data => Array.isArray(data) && setUsers(data))
			.catch(() => {})
	}, [withUsers])

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">Status</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
					{services.map(svc => (
						<div key={svc} className="flex items-center gap-1.5 min-w-0">
							<StatusDot status={status[svc]} />
							<span className="text-xs text-primary capitalize truncate">{svc}</span>
						</div>
					))}
				</div>

				{cameras.length > 0 && (
					<div className="border-t border-border pt-2 flex flex-col gap-0.5">
						{cameras.map(cam => (
							<div key={cam.id} className="flex items-center justify-between">
								<span className="text-xs text-muted">{cam.name}</span>
								<StatusDot status={status[`cam ${cam.name}`]} />
							</div>
						))}
					</div>
				)}

				{withUsers && users.length > 0 && (
					<div className="border-t border-border pt-2">
						<div className="flex items-center justify-between mb-1.5">
							<span className="text-xs font-medium text-muted uppercase tracking-wide">Users</span>
							<NavigateToRoute to="/admin" />
						</div>
						<div className="flex flex-col gap-1">
							{users.map(user => (
								<div key={user.username} className="flex items-center justify-between gap-2">
									<div className="flex flex-col min-w-0">
										<span className="text-xs text-primary truncate">{user.username}</span>
										<span className="text-[10px] text-muted">
											{user.last_login ? moment(user.last_login).fromNow() : "never"}
										</span>
									</div>
									<Badge className={user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted border border-border"}>
										{user.role}
									</Badge>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

export default Status
