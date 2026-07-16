import React from "react"
import { ArrowUpDown } from "lucide-react"

const ResizeHandle = ({ onPointerDown, grip = true }) => (
	<div className="relative w-full h-4 flex items-center cursor-ns-resize touch-none select-none group" onPointerDown={onPointerDown}>
		<div className="absolute inset-x-0 h-0.5 bg-border group-hover:bg-muted/40 transition-colors" />
		{grip && (
			<div className="absolute left-3 z-10 bg-bg pl-0.5 pr-1">
				<div className="w-8 h-0.5 rounded-full bg-muted/30 group-hover:bg-muted/50 transition-colors" />
			</div>
		)}
		<div className="absolute right-2 z-10 bg-bg">
			<ArrowUpDown className="size-3 text-muted/60 group-hover:text-muted transition-colors" />
		</div>
	</div>
)

export default ResizeHandle
