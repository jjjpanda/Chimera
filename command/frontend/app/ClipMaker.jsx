import React, { useState, useMemo, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ImageOff, Square, Minus, Plus, ZoomIn, Check, X } from "lucide-react"
import useCameras from "../hooks/useCameras"
import { Button } from "../components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Progress } from "../components/ui/progress"
import { request, jsonProcessing } from "../js/request"
import toast from "../js/toast"
import moment from "moment"

const PRESETS = [
	{ label: "15m", value: 15, unit: "minutes" },
	{ label: "30m", value: 30, unit: "minutes" },
	{ label: "1h",  value: 1,  unit: "hours" },
	{ label: "3h",  value: 3,  unit: "hours" },
	{ label: "6h",  value: 6,  unit: "hours" },
	{ label: "12h", value: 12, unit: "hours" },
	{ label: "24h", value: 24, unit: "hours" },
]

const lerp = (a, b, t) => moment(a.valueOf() + t * (b.valueOf() - a.valueOf()))

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const parseFrameTime = (url) => {
	const filename = url.split("/").pop()
	if (filename.indexOf("-") === 8) {
		const t = moment.utc(filename.slice(0, 8) + "-" + filename.slice(9, 15), "YYYYMMDD-HHmmss", true).local()
		if (t.isValid()) return t
	}
	return null
}

const CompoundSlider = ({ frameCount, scrubIdx, onScrubChange, trimRange, onTrimChange, trimming, disabled }) => {
	const trackRef = useRef(null)
	const scrubIdxRef = useRef(scrubIdx)
	const trimRangeRef = useRef(trimRange)

	useEffect(() => { scrubIdxRef.current = scrubIdx }, [scrubIdx])
	useEffect(() => { trimRangeRef.current = trimRange }, [trimRange])

	const getPct = (clientX) => {
		const rect = trackRef.current?.getBoundingClientRect()
		if (!rect) return 0
		return clamp((clientX - rect.left) / rect.width, 0, 1)
	}

	const startDrag = (e, type) => {
		e.preventDefault()
		let dragType = type
		if (dragType === "track") {
			const p = getPct(e.clientX)
			const newIdx = Math.round(p * Math.max(0, frameCount - 1))
			scrubIdxRef.current = newIdx
			onScrubChange(newIdx)
			dragType = "scrub"
		}
		const move = (ev) => {
			const p = getPct(ev.clientX)
			if (dragType === "scrub") {
				const newIdx = Math.round(p * Math.max(0, frameCount - 1))
				scrubIdxRef.current = newIdx
				onScrubChange(newIdx)
			} else if (dragType === "trim-start") {
				const [, curTe] = trimRangeRef.current
				const newTs = clamp(p * 100, 0, curTe - 1)
				const curScrubPct = scrubIdxRef.current / Math.max(1, frameCount - 1) * 100
				if (curScrubPct < newTs) {
					const newIdx = Math.round(newTs / 100 * Math.max(0, frameCount - 1))
					scrubIdxRef.current = newIdx
					onScrubChange(newIdx)
				}
				trimRangeRef.current = [newTs, curTe]
				onTrimChange([newTs, curTe])
			} else if (dragType === "trim-end") {
				const [curTs] = trimRangeRef.current
				const newTe = clamp(p * 100, curTs + 1, 100)
				const curScrubPct = scrubIdxRef.current / Math.max(1, frameCount - 1) * 100
				if (curScrubPct > newTe) {
					const newIdx = Math.round(newTe / 100 * Math.max(0, frameCount - 1))
					scrubIdxRef.current = newIdx
					onScrubChange(newIdx)
				}
				trimRangeRef.current = [curTs, newTe]
				onTrimChange([curTs, newTe])
			}
		}
		const up = () => {
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", up)
		}
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", up)
	}

	const scrubPct = frameCount > 1 ? (scrubIdx / (frameCount - 1)) * 100 : 0
	const [ts, te] = trimRange

	return (
		<div
			ref={trackRef}
			className="relative h-10 flex items-center select-none"
			style={{ cursor: disabled ? "default" : "pointer" }}
			onPointerDown={disabled ? undefined : (e) => startDrag(e, "track")}
		>
			<div className="absolute inset-x-0 h-3 bg-secondary rounded-full" />

			{trimming && (
				<>
					<div
						className="absolute inset-y-0 bg-accent/15 pointer-events-none"
						style={{ left: `${ts}%`, width: `${te - ts}%` }}
					/>
					<div
						className="absolute inset-y-0 w-2.5 bg-accent rounded-sm cursor-ew-resize z-10 touch-none"
						style={{ left: `${ts}%`, transform: "translateX(-50%)" }}
						onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "trim-start") }}
					/>
					<div
						className="absolute inset-y-0 w-2.5 bg-accent rounded-sm cursor-ew-resize z-10 touch-none"
						style={{ left: `${te}%`, transform: "translateX(-50%)" }}
						onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "trim-end") }}
					/>
				</>
			)}

			{!disabled && (
				<div
					className="absolute w-4 h-4 rounded-full bg-foreground border-2 border-background shadow z-20 touch-none"
					style={{ left: `${scrubPct}%`, transform: "translateX(-50%)" }}
					onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "scrub") }}
				/>
			)}
		</div>
	)
}

const ClipMaker = () => {
	const navigate = useNavigate()
	const [cameras] = useCameras()
	const [camera, setCamera] = useState(0)
	const [startDate, setStartDate] = useState(moment().subtract(1, "hour"))
	const [endDate, setEndDate] = useState(moment())
	const [number, setNumber] = useState(100)
	const [fps, setFps] = useState(20)
	const [skip, setSkip] = useState(1)
	const [frames, setFrames] = useState([])
	const [scrubIdx, setScrubIdx] = useState(0)
	const [trimRange, setTrimRange] = useState([0, 100])
	const [trimming, setTrimming] = useState(false)
	const [imagesLoaded, setImagesLoaded] = useState(0)
	const [fetching, setFetching] = useState(false)
	const [generating, setGenerating] = useState(null)
	const [pendingPreset, setPendingPreset] = useState(null)
	const [savedDates, setSavedDates] = useState(null)
	const [frameTimes, setFrameTimes] = useState([])

	const canvasRef = useRef(null)
	const imageCache = useRef({})

	useEffect(() => {
		setFrameTimes(frames.map(parseFrameTime))
	}, [frames])

	useEffect(() => {
		const canvas = canvasRef.current
		if (frames.length === 0) {
			imageCache.current = {}
			if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height)
			return
		}
		frames.forEach(url => {
			if (imageCache.current[url]) return
			const img = new Image()
			img.onload = img.onerror = () => setImagesLoaded(n => n + 1)
			img.src = url
			imageCache.current[url] = img
		})
	}, [frames])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas || frames.length === 0) return
		const img = imageCache.current[frames[scrubIdx]]
		if (!img?.complete || !img.naturalWidth) return
		if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
			canvas.width = img.naturalWidth
			canvas.height = img.naturalHeight
		}
		canvas.getContext("2d").drawImage(img, 0, 0)
	}, [scrubIdx, frames, imagesLoaded])

	const frameTime = (idx) => {
		if (frames.length === 0) return null
		return frameTimes[idx] ?? lerp(startDate, endDate, idx / Math.max(1, frames.length - 1))
	}

	const trimStart = useMemo(() => {
		const idx = Math.round(trimRange[0] / 100 * Math.max(0, frames.length - 1))
		return frameTime(idx) ?? lerp(startDate, endDate, trimRange[0] / 100)
	}, [startDate, endDate, trimRange, frames.length, frameTimes])

	const trimEnd = useMemo(() => {
		const idx = Math.round(trimRange[1] / 100 * Math.max(0, frames.length - 1))
		return frameTime(idx) ?? lerp(startDate, endDate, trimRange[1] / 100)
	}, [startDate, endDate, trimRange, frames.length, frameTimes])

	const scrubTime = useMemo(() => frameTime(scrubIdx),
		[frameTimes, scrubIdx, startDate, endDate, frames.length]
	)

	const downloadingImages = frames.length > 0 && imagesLoaded < frames.length
	const loading     = fetching || downloadingImages
	const stoppable   = downloadingImages
	const canGenerate = generating === null && !loading && startDate.isBefore(endDate)

	const loadPreview = (overrideStart, overrideEnd) => {
		if (loading) return
		const start = moment(overrideStart ?? startDate)
		const end   = moment(overrideEnd   ?? endDate)
		setFetching(true)
		setFrames([])
		setImagesLoaded(0)
		setTrimRange([0, 100])
		setTrimming(false)
		const camId = cameras[camera]?.id ?? camera + 1
		request("/convert/listFramesVideo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				camera: String(camId),
				start: start.utc().format("YYYYMMDD-HHmmss"),
				end: end.utc().format("YYYYMMDD-HHmmss"),
				frames: number
			})
		}, prom => jsonProcessing(prom, data => {
			setFrames(data?.list ?? [])
			setScrubIdx(0)
			setFetching(false)
		}))
	}

	const clickPreset = (p) => {
		if (!savedDates) setSavedDates({ start: startDate, end: endDate })
		setStartDate(moment().subtract(p.value, p.unit))
		setEndDate(moment())
		setPendingPreset(p)
	}

	const confirmPreset = () => {
		setSavedDates(null)
		setPendingPreset(null)
		loadPreview()
	}

	const cancelPreset = () => {
		if (savedDates) {
			setStartDate(savedDates.start)
			setEndDate(savedDates.end)
		}
		setSavedDates(null)
		setPendingPreset(null)
	}

	const zoomIn = () => {
		setStartDate(trimStart)
		setEndDate(trimEnd)
		loadPreview(trimStart, trimEnd)
	}

	const cancelTrim = () => {
		setTrimRange([0, 100])
		setTrimming(false)
	}

	const generate = (type) => {
		if (!canGenerate) return
		setGenerating(type)
		const camId = cameras[camera]?.id ?? camera + 1
		const endpoint = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		request(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				camera: String(camId),
				start: moment(trimStart).utc().format("YYYYMMDD-HHmmss"),
				end: moment(trimEnd).utc().format("YYYYMMDD-HHmmss"),
				save: true,
				...(type === "video" ? { fps } : { skip })
			})
		}, prom => jsonProcessing(prom, data => {
			setGenerating(null)
			if (!data || data.error) {
				toast("Generation failed")
			} else if (!data.url) {
				toast("No frames found")
			} else {
				toast(`${type === "video" ? "Video" : "Archive"} queued`)
				navigate("/recordings")
			}
		}))
	}

	const setDatePart = (setter, part, val) => {
		setPendingPreset(null)
		setSavedDates(null)
		setter(prev => {
			const next = prev.clone()
			if (part === "date") {
				const [y, m, d] = val.split("-")
				next.year(parseInt(y)).month(parseInt(m) - 1).date(parseInt(d))
			} else {
				const [h, min, sec] = val.split(":")
				next.hour(parseInt(h)).minute(parseInt(min)).second(sec ? parseInt(sec) : 0)
			}
			return next
		})
	}

	return (
		<div className="flex flex-col gap-0">
			<h1 className="px-4 pt-4 pb-3 text-lg font-semibold">clip maker</h1>

			<div className="relative bg-black w-full flex items-center justify-center" style={{ height: "200px" }}>
				<canvas
					ref={canvasRef}
					width={640}
					height={360}
					style={{ display: frames.length > 0 ? "block" : "none", maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" }}
				/>
				{frames.length === 0 && (
					<ImageOff className="h-10 w-10 opacity-40 text-muted" />
				)}
			</div>

			<div className="flex flex-col px-4 py-2 gap-1.5">
				{stoppable ? (
					<div className="flex items-center gap-2">
						<Progress value={Math.round(100 * imagesLoaded / frames.length)} className="h-2 flex-1" />
						<Button variant="outline" size="icon" className="size-8 shrink-0"
							onClick={() => { setFrames([]); setImagesLoaded(0) }}>
							<Square className="h-4 w-4" />
						</Button>
					</div>
				) : (
					<CompoundSlider
						frameCount={frames.length}
						scrubIdx={scrubIdx}
						onScrubChange={setScrubIdx}
						trimRange={trimRange}
						onTrimChange={setTrimRange}
						trimming={trimming}
						disabled={loading || frames.length === 0}
					/>
				)}

				{!stoppable && (
					<div className="flex items-center justify-between min-h-[18px]">
						<div className="text-xs text-muted">
							{trimming ? (
								<span>{trimStart.format("MM/DD HH:mm:ss")} → {trimEnd.format("MM/DD HH:mm:ss")}</span>
							) : scrubTime ? (
								<span>{scrubTime.format("MM/DD HH:mm:ss")}</span>
							) : null}
						</div>
						{frames.length > 0 && (
							trimming ? (
								<div className="flex gap-1">
									<Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={cancelTrim}>
										<X className="size-3" />
									</Button>
									<Button size="sm" className="h-6 gap-1 px-2 text-xs" onClick={zoomIn}>
										<Check className="size-3" />
										Confirm
									</Button>
								</div>
							) : (
								<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setTrimming(true)}>
									<ZoomIn className="size-3" />
									Zoom In
								</Button>
							)
						)}
					</div>
				)}

				{trimming && (
					<div className="flex justify-between text-[10px] text-muted/50">
						<span>{startDate.format("MM/DD HH:mm:ss")}</span>
						<span>{endDate.format("MM/DD HH:mm:ss")}</span>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-4 px-4 pt-2 pb-4">
				<div className="flex flex-col gap-1.5">
					<Label>Range</Label>
					<div className="flex flex-wrap gap-1">
						<Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={cancelPreset} disabled={!pendingPreset}>
							<X className="size-3" />
						</Button>
						{PRESETS.map(p => {
							const isPending = pendingPreset?.label === p.label
							return (
								<Button key={p.label} variant={isPending ? "default" : "outline"} size="sm" className="h-6 px-2 text-xs"
									onClick={() => isPending ? confirmPreset() : clickPreset(p)}>
									{isPending ? <Check className="size-3" /> : p.label}
								</Button>
							)
						})}
					</div>
				</div>

				<Button variant="outline" className="w-full" onClick={confirmPreset} disabled={loading}>
					{fetching ? "Fetching…" : downloadingImages ? "Loading…" : "Load Preview"}
				</Button>

				<div className="grid grid-cols-2 gap-3">
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
					<div className="flex flex-col gap-1.5">
						<Label>Frames</Label>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setNumber(n => Math.max(1, n - 10))}>
								<Minus className="size-4" />
							</Button>
							<span className="flex-1 text-center text-sm font-medium">{number}</span>
							<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setNumber(n => n + 10)}>
								<Plus className="size-4" />
							</Button>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-1.5">
					<div className="grid grid-cols-2 gap-x-3">
						<Label>Start</Label>
						<Label>End</Label>
					</div>
					<div className="grid grid-cols-2 gap-x-3 gap-y-2">
						<Input type="date" value={startDate.format("YYYY-MM-DD")}
							onChange={e => setDatePart(setStartDate, "date", e.target.value)} />
						<Input type="date" value={endDate.format("YYYY-MM-DD")}
							onChange={e => setDatePart(setEndDate, "date", e.target.value)} />
						<Input type="time" step="1" value={startDate.format("HH:mm:ss")}
							onChange={e => setDatePart(setStartDate, "time", e.target.value)} />
						<Input type="time" step="1" value={endDate.format("HH:mm:ss")}
							onChange={e => setDatePart(setEndDate, "time", e.target.value)} />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-xs text-muted">fps</Label>
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon" className="size-5" onClick={() => setFps(f => Math.max(1, f - 5))}>
									<Minus className="size-3" />
								</Button>
								<span className="w-7 text-center text-xs">{fps}</span>
								<Button variant="ghost" size="icon" className="size-5" onClick={() => setFps(f => f + 5)}>
									<Plus className="size-3" />
								</Button>
							</div>
						</div>
						<Button
							className="bg-accent text-accent-foreground hover:opacity-90"
							disabled={!canGenerate}
							onClick={() => generate("video")}
						>
							{generating === "video" ? "Generating…" : "Video"}
						</Button>
					</div>
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<Label className="text-xs text-muted">skip</Label>
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon" className="size-5" onClick={() => setSkip(s => Math.max(1, s - 1))}>
									<Minus className="size-3" />
								</Button>
								<span className="w-7 text-center text-xs">{skip}</span>
								<Button variant="ghost" size="icon" className="size-5" onClick={() => setSkip(s => s + 1)}>
									<Plus className="size-3" />
								</Button>
							</div>
						</div>
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
		</div>
	)
}

export default ClipMaker
