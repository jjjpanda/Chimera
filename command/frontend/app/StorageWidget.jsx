import React from "react"
import { useNavigate } from "react-router-dom"
import useStorageUsage from "../hooks/useStorageUsage.js"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import formatBytes from "../js/formatBytes.js"
import colors, { CHART_ACCENT } from "../js/colors.js"

const segmentColor = (i) => i === 0 ? CHART_ACCENT : colors[i % colors.length]

const StorageWidget = () => {
	const navigate = useNavigate()
	const [usage] = useStorageUsage()

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9
	const totalCamGb = usage.cameras.reduce((s, c) => s + Math.max(c.used_gb, 0.001), 0) || 1

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<div className="flex h-3 w-full overflow-hidden rounded-full">
					{usage.cameras.length > 0
						? usage.cameras.map((cam, i) => (
							<div key={cam.id} style={{ flex: `0 0 ${(Math.max(cam.used_gb, 0.001) / totalCamGb * 100).toFixed(3)}%`, backgroundColor: segmentColor(i) }} />
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
				<p className="text-xs text-muted">
					{usage.max_gb > 0
						? `${formatBytes(usedBytes, 1)} / ${formatBytes(maxBytes, 1)} USED`
						: `${formatBytes(usedBytes, 1)} USED`
					}
					{` • ${usage.total_frames.toLocaleString()} frames`}
				</p>
				<Button onClick={() => navigate("/stats")} className="mt-auto w-full">Manage Data</Button>
			</CardContent>
		</Card>
	)
}

export default StorageWidget
