import React from "react"
import formatBytes from "../js/formatBytes.js"

const TYPES = [
	{ key: "frames", label: "Frames", color: "#0e7dab" },
	{ key: "videos", label: "Videos", color: "#FF6633" },
	{ key: "zips", label: "Zips", color: "#E6B333" },
	{ key: "objects", label: "Objects", color: "#33991A" },
	{ key: "other", label: "Other", color: "#999966" },
]

const StorageBreakdown = ({ breakdown }) => {
	if (!breakdown) return null
	const total = TYPES.reduce((sum, t) => sum + (breakdown[t.key] || 0), 0) || 1
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs font-medium text-muted">Storage Breakdown</span>
			<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
				{TYPES.map(t => {
					const v = breakdown[t.key] || 0
					return v > 0
						? <div key={t.key} style={{ flex: `0 0 ${(v / total * 100).toFixed(3)}%`, backgroundColor: t.color }} />
						: null
				})}
			</div>
			<div className="flex flex-wrap gap-x-3 gap-y-0.5">
				{TYPES.map(t => (
					<span key={t.key} className="flex items-center gap-1 text-[11px] text-muted">
						<span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
						{t.label} {formatBytes(breakdown[t.key] || 0, 1)}
					</span>
				))}
			</div>
		</div>
	)
}

export default StorageBreakdown
