import React from "react"
import useChimeraStatus from "../hooks/useChimeraStatus"
import useCameras from "../hooks/useCameras.js"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { cn } from "../lib/utils"

const StatusDot = ({ status }) => (
	<span className={cn(
		"inline-block size-2.5 rounded-full shrink-0",
		status === "up" && "bg-emerald-500",
		status === "down" && "bg-danger",
		(!status || status === "loading") && "bg-muted animate-pulse"
	)} />
)

const StatusRow = ({ label, status, indent = false }) => (
	<div className={cn("flex items-center justify-between py-1", indent && "pl-4")}>
		<span className="text-sm text-primary capitalize">{label}</span>
		<StatusDot status={status} />
	</div>
)

const services = ["command", "schedule", "storage", "motion", "database", "livestream", "memory", "object"]

const StatusTree = () => {
	const [status] = useChimeraStatus()
	const [cameras] = useCameras()

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">System Status</CardTitle>
			</CardHeader>
			<CardContent className="divide-y divide-border">
				{services.map((svc) => (
					<StatusRow key={svc} label={svc} status={status[svc]} />
				))}
				{cameras.map((cam) => (
					<StatusRow key={cam.id} label={cam.name} status={status[`cam ${cam.name}`]} indent />
				))}
			</CardContent>
		</Card>
	)
}

export default StatusTree
