import React from "react"
import { useTranslation } from "react-i18next"
import formatBytes from "../js/formatBytes.js"

const TYPES = [
	{ key: "frames", labelKey: "storage.framesLabel", color: "#06b6d4" },
	{ key: "videos", labelKey: "storage.videosLabel", color: "#FF6633" },
	{ key: "zips", labelKey: "storage.zipsLabel", color: "#E6B333" },
	{ key: "objects", labelKey: "storage.objectsLabel", color: "#33991A" },
	{ key: "other", labelKey: "storage.otherLabel", color: "#999966" },
]

const StorageBreakdown = ({ breakdown }) => {
	const { t } = useTranslation()
	if (!breakdown) return null
	const total = TYPES.reduce((sum, type) => sum + (breakdown[type.key] || 0), 0) || 1
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs font-medium text-muted">{t("storage.breakdownTitle")}</span>
			<div className="flex h-2 w-full overflow-hidden rounded-full bg-border">
				{TYPES.map(type => {
					const v = breakdown[type.key] || 0
					return v > 0
						? <div key={type.key} style={{ flex: `0 0 ${(v / total * 100).toFixed(3)}%`, backgroundColor: type.color }} />
						: null
				})}
			</div>
			<div className="flex flex-wrap gap-x-3 gap-y-0.5">
				{TYPES.map(type => (
					<span key={type.key} className="flex items-center gap-1 text-[11px] text-muted">
						<span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
						{t(type.labelKey)} {formatBytes(breakdown[type.key] || 0, 1)}
					</span>
				))}
			</div>
		</div>
	)
}

export default StorageBreakdown
