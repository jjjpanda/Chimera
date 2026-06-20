import React from "react"
import { useNavigate } from "react-router-dom"
import useStorageUsage from "../hooks/useStorageUsage.js"
import StorageBreakdown from "./StorageBreakdown.jsx"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import formatBytes from "../js/formatBytes.js"
import colors, { CHART_ACCENT } from "../js/colors.js"
import { useRole } from "./AuthContext"

const segmentColor = (i) => i === 0 ? CHART_ACCENT : colors[i % colors.length]

const StorageWidget = () => {
	const navigate = useNavigate()
	const role = useRole()
	const [usage] = useStorageUsage()

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9
	const maxCamGb = Math.max(...usage.cameras.map(c => c.used_gb), 0.001)

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{usage.cameras.length > 0 ? (
					<div className="flex flex-col gap-2">
						{usage.cameras.map((cam, i) => (
							<div key={cam.id} className="flex flex-col gap-1">
								<div className="flex items-center justify-between text-xs">
									<span className="flex items-center gap-1.5 text-primary">
										<span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: segmentColor(i) }} />
										{cam.name}
									</span>
									<span className="text-muted">{formatBytes(cam.used_gb * 1e9, 1)}</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full transition-all"
										style={{ width: `${((cam.used_gb / maxCamGb) * 100).toFixed(1)}%`, backgroundColor: segmentColor(i) }}
									/>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="h-2 w-full rounded-full bg-muted" />
				)}

				<StorageBreakdown breakdown={usage.breakdown} />

				{usage.max_gb > 0 && (
					<div className="flex flex-col gap-1">
						<div className="flex items-center justify-between text-xs text-muted">
							<span>Total</span>
							<span>{Math.round(Math.min(100, (usage.used_gb / usage.max_gb) * 100))}%</span>
						</div>
						<div className="h-2 w-full overflow-hidden rounded-full bg-border">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${Math.min(100, (usage.used_gb / usage.max_gb) * 100)}%` }}
							/>
						</div>
					</div>
				)}

				<p className="text-xs text-muted">
					{usage.max_gb > 0
						? `${formatBytes(usedBytes, 1)} / ${formatBytes(maxBytes, 1)} USED`
						: `${formatBytes(usedBytes, 1)} USED`
					}
					{` • ${usage.total_frames.toLocaleString()} frames`}
				</p>
				<Button onClick={() => navigate("/stats")} className="mt-auto w-full">{role === "admin" ? "Manage Data" : "View Stats"}</Button>
			</CardContent>
		</Card>
	)
}

export default StorageWidget
