import React from "react"
import { ImageOff } from "lucide-react"
import { Card } from "./ui/card"

const CameraGridMini = ({ slots, renderCell, cellLabel, onCellClick, centerIcon, onActivate }) => (
	<Card className="h-full overflow-hidden cursor-pointer select-none transition-shadow" onClick={onActivate}>
		<div className="relative flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-border min-h-0 h-full">
			{slots.map((slot, i) => (
				<div
					key={i}
					onClick={slot ? (e) => { e.stopPropagation(); onCellClick(slot) } : undefined}
					className={`relative overflow-hidden ${slot ? "bg-black" : "bg-muted/20"}`}
				>
					{slot ? renderCell(slot) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<ImageOff className="size-5 opacity-30 text-muted" />
						</div>
					)}
					{slot && cellLabel(slot) != null && (
						<div className="absolute bottom-1.5 inset-x-0 flex justify-center pointer-events-none">
							<span className="bg-accent/85 text-accent-foreground text-xs font-medium px-3 py-0.5 rounded-full">
								{cellLabel(slot)}
							</span>
						</div>
					)}
				</div>
			))}
			<div className="absolute inset-0 m-auto z-10 rounded-full shadow-lg size-14 flex items-center justify-center bg-accent text-accent-foreground" onClick={(e) => { e.stopPropagation(); onActivate() }}>
				{centerIcon}
			</div>
		</div>
	</Card>
)

export default CameraGridMini
