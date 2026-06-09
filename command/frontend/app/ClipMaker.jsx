import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ImageOff, Square, Minus, Plus, ZoomIn } from "lucide-react"
import useCameras from "../hooks/useCameras"
import { Button } from "../components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Slider } from "../components/ui/slider"
import { Progress } from "../components/ui/progress"
import { request, jsonProcessing } from "../js/request"
import moment from "moment"

const lerp = (a, b, t) => moment(a.valueOf() + t * (b.valueOf() - a.valueOf()))

const ClipMaker = () => {
	const navigate = useNavigate()
	const [cameras] = useCameras()
	const [camera, setCamera] = useState(0)
	const [startDate, setStartDate] = useState(moment().subtract(1, "hour"))
	const [endDate, setEndDate] = useState(moment())
	const [number, setNumber] = useState(100)
	const [frames, setFrames] = useState([])
	const [scrubIdx, setScrubIdx] = useState(0)
	const [trimRange, setTrimRange] = useState([0, 100])
	const [imagesLoaded, setImagesLoaded] = useState(0)
	const [fetching, setFetching] = useState(false)
	const [generating, setGenerating] = useState(null)

	const trimStart  = useMemo(() => lerp(startDate, endDate, trimRange[0] / 100), [startDate, endDate, trimRange])
	const trimEnd    = useMemo(() => lerp(startDate, endDate, trimRange[1] / 100), [startDate, endDate, trimRange])
	const scrubTime  = useMemo(() =>
		frames.length > 0 ? lerp(startDate, endDate, scrubIdx / Math.max(1, frames.length - 1)) : null,
		[startDate, endDate, scrubIdx, frames.length]
	)

	// derived — no separate loading state needed
	const downloadingImages = frames.length > 0 && imagesLoaded < frames.length
	const loading    = fetching || downloadingImages
	const stoppable  = downloadingImages
	const hasTrim    = trimRange[0] !== 0 || trimRange[1] !== 100
	const canGenerate = generating === null && !loading && startDate.isBefore(endDate)

	const loadPreview = (overrideStart, overrideEnd) => {
		if (loading) return
		const start = moment(overrideStart ?? startDate)
		const end   = moment(overrideEnd   ?? endDate)
		setFetching(true)
		setFrames([])
		setImagesLoaded(0)
		setTrimRange([0, 100])
		const camId = cameras[camera]?.id ?? camera + 1
		request("/convert/listFramesVideo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				camera: String(camId),
				start: start.utc().second(0).format("YYYYMMDD-HHmmss"),
				end: end.utc().second(0).format("YYYYMMDD-HHmmss"),
				frames: number
			})
		}, prom => jsonProcessing(prom, data => {
			const list = data.list ?? []
			setFrames(list)
			setScrubIdx(0)
			setFetching(false)
		}))
	}

	const zoomIn = () => {
		const newStart = trimStart
		const newEnd   = trimEnd
		setStartDate(newStart)
		setEndDate(newEnd)
		loadPreview(newStart, newEnd)
	}

	const generate = (type) => {
		if (!canGenerate) return
		setGenerating(type)
		const camId = cameras[camera]?.id ?? camera + 1
		const endpoint = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		const body = {
			camera: String(camId),
			start: moment(trimStart).second(0).format("YYYYMMDD-HHmmss"),
			end: moment(trimEnd).second(0).format("YYYYMMDD-HHmmss"),
			save: true,
			...(type === "video" ? { fps: 20 } : { skip: number })
		}
		request(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		}, prom => jsonProcessing(prom, () => { setGenerating(null); navigate("/recordings") }))
	}

	return (
		<div className="flex flex-col gap-0">
			<h1 className="px-4 pt-4 pb-3 text-lg font-semibold">clip maker</h1>

			<div className="relative flex items-center justify-center bg-black" style={{ minHeight: "200px" }}>
				{frames.length > 0 ? (
					frames.map((frame, i) => (
						<img
							key={i}
							src={frame}
							style={{ display: scrubIdx === i ? "block" : "none", objectFit: "contain", maxHeight: "360px", width: "100%" }}
							onLoad={() => setImagesLoaded(n => n + 1)}
							onError={() => setImagesLoaded(n => n + 1)}
							loading="eager"
						/>
					))
				) : (
					<div className="flex flex-col items-center gap-2 py-12 text-muted">
						<ImageOff className="h-10 w-10 opacity-40" />
					</div>
				)}
			</div>

			<div className="flex flex-col px-4 py-2 gap-1">
				<div className="flex items-center gap-2">
					{stoppable ? (
						<>
							<Progress value={Math.round(100 * imagesLoaded / frames.length)} className="h-2 flex-1" />
							<Button variant="outline" size="icon" className="size-8 shrink-0"
								onClick={() => { setFrames([]); setImagesLoaded(0) }}>
								<Square className="h-4 w-4" />
							</Button>
						</>
					) : (
						<Slider
							min={0}
							max={Math.max(0, frames.length - 1)}
							value={[scrubIdx]}
							onValueChange={([val]) => setScrubIdx(val)}
							disabled={loading || frames.length === 0}
						/>
					)}
				</div>
				{!stoppable && scrubTime && (
					<div className="text-center text-xs text-muted">{scrubTime.format("MM/DD HH:mm:ss")}</div>
				)}
			</div>

			{frames.length > 0 && !stoppable && (
				<div className="flex flex-col gap-1.5 px-4 pb-3">
					<div className="flex items-center justify-between">
						<div className="flex gap-2 text-xs text-muted">
							<span>{trimStart.format("MM/DD HH:mm")}</span>
							<span>→</span>
							<span>{trimEnd.format("MM/DD HH:mm")}</span>
						</div>
						{hasTrim && (
							<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={zoomIn}>
								<ZoomIn className="size-3" />
								Zoom In
							</Button>
						)}
					</div>
					<Slider min={0} max={100} step={1} value={trimRange} onValueChange={setTrimRange} />
					<div className="flex justify-between text-[10px] text-muted/60">
						<span>{startDate.format("MM/DD HH:mm")}</span>
						<span>{endDate.format("MM/DD HH:mm")}</span>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-4 px-4 pt-2 pb-4">
				<div className="flex flex-col gap-1.5">
					<Label>Camera</Label>
					<Select value={String(camera)} onValueChange={v => setCamera(parseInt(v))}>
						<SelectTrigger><SelectValue placeholder="Select camera" /></SelectTrigger>
						<SelectContent>
							{cameras.map((cam, i) => (
								<SelectItem key={cam.id} value={String(i)}>{cam.name}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1.5">
						<Label>Start</Label>
						<Input type="datetime-local" value={startDate.format("YYYY-MM-DDTHH:mm")}
							onChange={e => setStartDate(moment(e.target.value))} />
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>End</Label>
						<Input type="datetime-local" value={endDate.format("YYYY-MM-DDTHH:mm")}
							onChange={e => setEndDate(moment(e.target.value))} />
					</div>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label>Frames</Label>
					<div className="flex items-center gap-3">
						<Button variant="outline" size="icon" onClick={() => setNumber(n => Math.max(1, n - 10))}>
							<Minus className="size-4" />
						</Button>
						<span className="min-w-12 text-center text-sm font-medium">{number}</span>
						<Button variant="outline" size="icon" onClick={() => setNumber(n => n + 10)}>
							<Plus className="size-4" />
						</Button>
					</div>
				</div>

				<Button variant="outline" className="w-full" onClick={loadPreview} disabled={loading}>
					{fetching ? "Fetching…" : downloadingImages ? "Loading…" : "Load Preview"}
				</Button>

				<div className="grid grid-cols-2 gap-2">
					<Button
						className="bg-accent text-accent-foreground hover:opacity-90"
						disabled={!canGenerate}
						onClick={() => generate("video")}
					>
						{generating === "video" ? "Generating…" : "Video"}
					</Button>
					<Button
						variant="outline"
						disabled={!canGenerate}
						onClick={() => generate("zip")}
					>
						{generating === "zip" ? "Generating…" : "Archive"}
					</Button>
				</div>
			</div>
		</div>
	)
}

export default ClipMaker
