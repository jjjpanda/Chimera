import React from "react"
import { contentViewBox } from "../js/detections.js"

const STROKE = "#34d399"

const DetectionOverlay = ({ boxes, dims, pad, fit = "none", className = "pointer-events-none absolute inset-0 w-full h-full", style, width, height }) => (
	<svg
		className={className}
		style={style}
		width={width}
		height={height}
		viewBox={contentViewBox(dims, pad)}
		preserveAspectRatio={fit}
	>
		{boxes.map((d, i) => (
			<g key={i}>
				<rect x={d.box[0]} y={d.box[1]} width={d.box[2]} height={d.box[3]}
					fill="none" stroke={STROKE} strokeWidth={2} rx={2} />
				<text x={d.box[0] + 3} y={Math.max((pad?.top ?? 0) + 12, d.box[1] - 4)}
					fontSize={13} fill={STROKE}
					style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 3, fontWeight: 600 }}>
					{`${d.type} ${Math.round(d.confidence * 100)}%`}
				</text>
			</g>
		))}
	</svg>
)

export { STROKE }
export default DetectionOverlay
