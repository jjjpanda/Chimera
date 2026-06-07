import React from "react"
import { ImageOff, Square } from "lucide-react"
import usePastImages from "../hooks/usePastImages.js"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Slider } from "../components/ui/slider"
import { Progress } from "../components/ui/progress"
import { Button } from "../components/ui/button"
import CameraDateNumberPicker from "./CameraDateNumberPicker.jsx"
import NavigateToRoute from "./NavigateToRoute.jsx"

const SummaryScrubber = (props) => {
	const [state, setState, listHasContents, stoppable, onReload] = usePastImages(props.numberOfFrames)

	return (
		<Card className="flex flex-col gap-0 overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between py-3 px-4">
				<CardTitle className="text-sm font-medium">Past Images</CardTitle>
				{props.withButton && <NavigateToRoute to={"/scrub"} />}
			</CardHeader>

			<div className="relative bg-bg flex items-center justify-center" style={{ minHeight: "200px" }}>
				{listHasContents ? (
					state.list.map((frame, index) => (
						<img
							key={index}
							src={frame}
							style={{ display: state.sliderIndex === index ? "block" : "none", objectFit: "contain", maxHeight: "360px", width: "100%" }}
							onLoad={() => setState((s) => ({ ...s, imagesLoaded: s.imagesLoaded + 1 }))}
							onError={() => setState((s) => ({ ...s, imagesLoaded: s.imagesLoaded + 1 }))}
							loading="eager"
						/>
					))
				) : (
					<div className="flex flex-col items-center gap-2 py-12 text-muted">
						<ImageOff className="h-10 w-10 opacity-40" />
						<span className="text-sm">No images available</span>
					</div>
				)}
			</div>

			<CardContent className="flex flex-col gap-3 pt-3 px-4 pb-4">
				<div className="flex items-center gap-2">
					<div className="flex-1">
						{stoppable ? (
							<Progress value={Math.round(100 * state.imagesLoaded / state.list.length)} className="h-2" />
						) : (
							<Slider
								min={0}
								max={Math.min(state.number - 1, state.list.length - 1)}
								value={[state.sliderIndex]}
								onValueChange={([val]) => setState((s) => ({ ...s, sliderIndex: val }))}
								disabled={state.loading}
							/>
						)}
					</div>
					<Button
						variant="outline"
						size="icon"
						disabled={!stoppable}
						onClick={() => setState((s) => ({ ...s, list: ["/res/logo.png"] }))}
					>
						<Square className="h-4 w-4" />
					</Button>
				</div>

				<CameraDateNumberPicker
					camera={state.camera}
					cameras={state.cameras}
					startDate={state.startDate}
					endDate={state.endDate}
					number={state.number}
					numberType={state.numberType}
					disabled={stoppable}
					onChange={onReload}
					mobile={props.mobile}
				/>
			</CardContent>
		</Card>
	)
}

export default SummaryScrubber
