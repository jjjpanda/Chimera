import React from "react"
import useChimeraStatus from "../hooks/useChimeraStatus"
import useCameras from "../hooks/useCameras.js"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { cn } from "../lib/utils"

const StatusDot = ({ status }) => (
	<span className={cn(
		"inline-block size-2 rounded-full shrink-0",
		status === "up" && "bg-emerald-500",
		status === "down" && "bg-danger",
		(!status || status === "loading") && "bg-muted animate-pulse"
	)} />
)

const services = ["command", "schedule", "storage", "motion", "database", "livestream", "memory"]

const Status = () => {
	const [status] = useChimeraStatus()
	const [cameras] = useCameras()

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">Status</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="grid gap-x-2 gap-y-1.5" style={{gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))"}}>
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
			</CardContent>
		</Card>
	)
}

export default Status
