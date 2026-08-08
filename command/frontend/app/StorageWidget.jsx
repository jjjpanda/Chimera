import React from "react"
import { useTranslation } from "react-i18next"
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
	const { t } = useTranslation()
	const navigate = useNavigate()
	const role = useRole()
	const [usage] = useStorageUsage()

	const usedBytes = usage.used_gb * 1e9
	const maxBytes = usage.max_gb * 1e9
	const maxCamGb = Math.max(...usage.cameras.map(c => c.used_gb), 0.001)

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium">{t("storage.usageTitle")}</CardTitle>
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
								<div className="h-2 w-full overflow-hidden rounded-full bg-border">
									<div
										className="h-full rounded-full transition-all"
										style={{ width: `${((cam.used_gb / maxCamGb) * 100).toFixed(1)}%`, backgroundColor: segmentColor(i) }}
									/>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="h-2 w-full rounded-full bg-border" />
				)}

				<StorageBreakdown breakdown={usage.breakdown} />

				{usage.max_gb > 0 && (
					<div className="flex flex-col gap-1">
						<div className="flex items-center justify-between text-xs text-muted">
							<span>{t("storage.total")}</span>
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
						? t("storage.usedOfMax", { used: formatBytes(usedBytes, 1), max: formatBytes(maxBytes, 1) })
						: t("storage.used", { used: formatBytes(usedBytes, 1) })
					}
					{` • ${t("storage.frames", { count: usage.total_frames.toLocaleString() })}`}
				</p>
				<Button onClick={() => navigate("/stats")} className="mt-auto w-full">{role === "admin" ? t("storage.manageData") : t("storage.viewStats")}</Button>
			</CardContent>
		</Card>
	)
}

export default StorageWidget
