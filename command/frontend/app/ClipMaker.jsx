import React, { useState, useMemo, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useRole } from "./AuthContext"
import { ImageOff, Square, Minus, Plus, ZoomIn, Check, X, Rewind, LayoutGrid, RectangleHorizontal, ArrowUpDown, Save, SkipBack } from "lucide-react"
import { useMediaQuery } from "react-responsive"
import useCameras from "../hooks/useCameras"
import { Card, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import NavigateToRoute from "./NavigateToRoute"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Progress } from "../components/ui/progress"
import { request, jsonProcessing } from "../js/request"
import toast from "../js/toast"
import moment from "moment"

const PRESETS = [
	{ label: "30m", value: 30, unit: "minutes" },
	{ label: "1h",  value: 1,  unit: "hours" },
	{ label: "4h",  value: 3,  unit: "hours" },
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
			if (trimming) {
				const [curTs, curTe] = trimRangeRef.current
				const pPct = p * 100
				dragType = Math.abs(pPct - curTs) <= Math.abs(pPct - curTe) ? "trim-start" : "trim-end"
				if (dragType === "trim-start") {
					const newTs = clamp(pPct, 0, curTe - 1)
					trimRangeRef.current = [newTs, curTe]
					onTrimChange([newTs, curTe])
				} else {
					const newTe = clamp(pPct, curTs + 1, 100)
					trimRangeRef.current = [curTs, newTe]
					onTrimChange([curTs, newTe])
				}
			} else {
				const newIdx = Math.round(p * Math.max(0, frameCount - 1))
				scrubIdxRef.current = newIdx
				onScrubChange(newIdx)
				dragType = "scrub"
			}
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
			className="relative h-16 flex items-center select-none"
			style={{ cursor: disabled ? "default" : "pointer" }}
			onPointerDown={disabled ? undefined : (e) => startDrag(e, "track")}
		>
			<div className="absolute inset-x-0 h-5 bg-secondary rounded-full" />

			{trimming && (
				<>
					<div
						className="absolute inset-y-0 bg-accent/15 pointer-events-none"
						style={{ left: `${ts}%`, width: `${te - ts}%` }}
					/>
					<div
						className="absolute inset-y-0 w-5 bg-accent rounded-sm cursor-ew-resize z-10 touch-none"
						style={{ left: `${ts}%`, transform: "translateX(-50%)" }}
						onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "trim-start") }}
					/>
					<div
						className="absolute inset-y-0 w-5 bg-accent rounded-sm cursor-ew-resize z-10 touch-none"
						style={{ left: `${te}%`, transform: "translateX(-50%)" }}
						onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "trim-end") }}
					/>
				</>
			)}

			{!disabled && (
				<div
					className={`absolute rounded-full bg-primary ring-2 ring-accent shadow-lg z-20 touch-none cursor-grab transition-[width,height,opacity] ${trimming ? "w-4 h-4 opacity-50" : "w-8 h-8"}`}
					style={{ left: `${scrubPct}%`, transform: "translateX(-50%)" }}
					onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "scrub") }}
				/>
			)}
		</div>
	)
}

const ClipMakerMini = () => {
	const navigate = useNavigate()
	const [cameras] = useCameras()
	const [snapshots, setSnapshots] = useState({})

	useEffect(() => {
		if (!cameras.length) return
		cameras.slice(0, 4).forEach(cam => {
			const end = moment().utc().format("YYYYMMDD-HHmmss")
			const start = moment().subtract(24, "hours").utc().format("YYYYMMDD-HHmmss")
			request("/convert/listFramesVideo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ camera: String(cam.id), start, end, frames: 1 })
			}, prom => jsonProcessing(prom, data => {
				const url = data?.list?.[0]
				if (url) setSnapshots(s => ({ ...s, [cam.id]: url }))
			}))
		})
	}, [cameras])

	const camSlots = cameras.slice(0, 4)
	const slots = [0, 1, 2, 3].map(i => camSlots[i] ?? null)

	return (
		<Card className="h-full overflow-hidden">
			<div className="relative flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-border min-h-0">
				{slots.map((cam, i) => (
					<div key={i} className={`relative overflow-hidden ${cam ? "bg-black" : "bg-muted/20"}`}>
						{cam && snapshots[cam.id] && (
							<img src={snapshots[cam.id]} className="w-full h-full object-cover" alt={cam.name} />
						)}
						{cam && !snapshots[cam.id] && (
							<div className="absolute inset-0 flex items-center justify-center">
								<ImageOff className="size-5 opacity-30 text-muted" />
							</div>
						)}
						{cam && (
							<div className="absolute bottom-1.5 inset-x-0 flex justify-center">
								<span className="bg-accent/85 text-accent-foreground text-xs font-medium px-3 py-0.5 rounded-full">
									{cam.name}
								</span>
							</div>
						)}
					</div>
				))}
				<Button
					className="absolute inset-0 m-auto z-10 rounded-full shadow-lg size-14"
					onClick={() => navigate("/clip")}
				>
					<Rewind className="size-6" />
				</Button>
			</div>
		</Card>
	)
}

const ClipMaker = ({ mini } = {}) => {
	if (mini) return <ClipMakerMini />
	const isDesktop = useMediaQuery({ query: "(min-width: 601px)" })
	const role = useRole()
	const isAdmin = role === "admin"
	const navigate = useNavigate()
	const [cameras] = useCameras()

	// single-cam state
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
	const [previewHeight, setPreviewHeight] = useState(200)

	const canvasRef = useRef(null)
	const imageCache = useRef({})

	// multi-cam state
	const [multiCam, setMultiCam] = useState(false)
	const [selectedCams, setSelectedCams] = useState([]) // camera indices, up to 4
	const [camStates, setCamStates] = useState({}) // { [camId]: { frames, imagesLoaded, fetching } }
	const [multiGenerating, setMultiGenerating] = useState({})
	const multiCanvasRefs = useRef({})
	const multiImageCache = useRef({})

	useEffect(() => {
		if (!isDesktop && multiCam) toggleMultiCam()
	}, [isDesktop])

	// single-cam effects
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
			let settled = false
			let timer
			const settle = () => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				setImagesLoaded(n => n + 1)
			}
			img.onload = img.onerror = settle
			timer = setTimeout(settle, 10000)
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

	// multi-cam: load images when frame lists change
	const multiAllFrames = useMemo(() =>
		multiCam ? Object.fromEntries(Object.entries(camStates).map(([id, s]) => [id, s.frames])) : {},
		[multiCam, camStates]
	)

	useEffect(() => {
		if (!multiCam) return
		Object.entries(multiAllFrames).forEach(([camId, camFrames]) => {
			if (!multiImageCache.current[camId]) multiImageCache.current[camId] = {}
			camFrames.forEach(url => {
				if (multiImageCache.current[camId][url]) return
				const img = new Image()
				let settled = false
				let timer
				const settle = () => {
					if (settled) return
					settled = true
					clearTimeout(timer)
					setCamStates(s => s[camId] ? ({
						...s,
						[camId]: { ...s[camId], imagesLoaded: (s[camId].imagesLoaded ?? 0) + 1 }
					}) : s)
				}
				img.onload = img.onerror = settle
				timer = setTimeout(settle, 10000)
				img.src = url
				multiImageCache.current[camId][url] = img
			})
		})
	}, [multiCam, multiAllFrames])

	const multiFrameTimes = useMemo(() =>
		multiCam ? Object.fromEntries(Object.entries(camStates).map(([id, s]) => [id, s.frames.map(parseFrameTime)])) : {},
		[multiCam, camStates]
	)

	const multiFrameCount = useMemo(() => {
		if (!multiCam) return 0
		const counts = Object.values(camStates).map(s => s.frames.length).filter(n => n > 0)
		return counts.length > 0 ? Math.max(...counts) : 0
	}, [multiCam, camStates])

	const multiRows = selectedCams.length > 0 ? Math.ceil(selectedCams.length / 2) : 2

	// multi-cam: paint canvases on scrub, syncing by timestamp
	useEffect(() => {
		if (!multiCam) return
		const pct = multiFrameCount > 1 ? scrubIdx / (multiFrameCount - 1) : 0
		const currentTime = lerp(startDate, endDate, pct)
		Object.entries(camStates).forEach(([camId, state]) => {
			const canvas = multiCanvasRefs.current[camId]
			if (!canvas || !state.frames.length) return
			const times = multiFrameTimes[camId]
			let bestIdx = 0
			if (times?.length) {
				let bestDiff = Infinity
				times.forEach((t, i) => {
					if (!t) return
					const diff = Math.abs(t.valueOf() - currentTime.valueOf())
					if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
				})
			}
			const img = multiImageCache.current[camId]?.[state.frames[bestIdx]]
			if (!img?.complete || !img.naturalWidth) return
			if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
				canvas.width = img.naturalWidth
				canvas.height = img.naturalHeight
			}
			canvas.getContext("2d").drawImage(img, 0, 0)
		})
	}, [multiCam, scrubIdx, camStates, multiFrameCount, multiFrameTimes, startDate, endDate])

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

	const multiAnyFetching = multiCam && Object.values(camStates).some(s => s.fetching)
	const multiAnyDownloading = multiCam && Object.values(camStates).some(s => s.frames.length > 0 && s.imagesLoaded < s.frames.length)
	const multiAnyGenerating = Object.values(multiGenerating).some(Boolean)

	const downloadingImages = frames.length > 0 && imagesLoaded < frames.length
	const loading   = multiCam ? (multiAnyFetching || multiAnyDownloading) : (fetching || downloadingImages)
	const stoppable = multiCam ? multiAnyDownloading : downloadingImages

	const canGenerate = multiCam
		? (!multiAnyFetching && !multiAnyDownloading && !multiAnyGenerating && startDate.isBefore(endDate) && selectedCams.length > 0)
		: (generating === null && !loading && startDate.isBefore(endDate))

	const multiScrubTime = useMemo(() => {
		if (!multiCam || multiFrameCount === 0) return null
		return lerp(startDate, endDate, multiFrameCount > 1 ? scrubIdx / (multiFrameCount - 1) : 0)
	}, [multiCam, scrubIdx, multiFrameCount, startDate, endDate])

	const activeFrameCount = multiCam ? multiFrameCount : frames.length

	const toggleMultiCam = () => {
		setMultiCam(m => !m)
		setSelectedCams([])
		setCamStates({})
		multiImageCache.current = {}
		setFrames([])
		setImagesLoaded(0)
		setTrimRange([0, 100])
		setTrimming(false)
		setScrubIdx(0)
	}

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

	const loadMultiPreview = (overrideStart, overrideEnd) => {
		if (loading || !selectedCams.length) return
		const start = moment(overrideStart ?? startDate)
		const end   = moment(overrideEnd   ?? endDate)
		multiImageCache.current = {}
		setScrubIdx(0)
		setTrimRange([0, 100])
		setTrimming(false)
		const camIds = selectedCams.map(idx => cameras[idx]?.id ?? idx + 1)
		setCamStates(Object.fromEntries(camIds.map(id => [id, { frames: [], imagesLoaded: 0, fetching: true }])))
		camIds.forEach(camId => {
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
				setCamStates(s => ({ ...s, [camId]: { frames: data?.list ?? [], imagesLoaded: 0, fetching: false } }))
			}))
		})
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
		if (multiCam) loadMultiPreview()
		else loadPreview()
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
		if (multiCam) loadMultiPreview(trimStart, trimEnd)
		else loadPreview(trimStart, trimEnd)
	}

	const cancelTrim = () => {
		setTrimRange([0, 100])
		setTrimming(false)
	}

	const generate = (type) => {
		if (!canGenerate) return
		if (multiCam) { generateMulti(type); return }
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
				...(type === "video" ? { fps, skip } : { skip })
			})
		}, prom => jsonProcessing(prom, data => {
			setGenerating(null)
			if (!data || data.error) {
				toast("Generation failed")
			} else if (!data.url) {
				toast("No frames found")
			} else {
				toast(`${type === "video" ? "Video" : "Archive"} queued`)
				setTimeout(() => navigate("/recordings"), 1500)
			}
		}))
	}

	const generateMulti = (type) => {
		const endpoint = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		selectedCams.forEach(idx => {
			const camId = cameras[idx]?.id ?? idx + 1
			setMultiGenerating(g => ({ ...g, [camId]: type }))
			request(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					camera: String(camId),
					start: moment(trimStart).utc().format("YYYYMMDD-HHmmss"),
					end: moment(trimEnd).utc().format("YYYYMMDD-HHmmss"),
					save: true,
					...(type === "video" ? { fps, skip } : { skip })
				})
			}, prom => jsonProcessing(prom, data => {
				setMultiGenerating(g => ({ ...g, [camId]: null }))
				if (!data || data.error || !data.url) {
					toast(`Failed: ${cameras.find(c => c.id === camId)?.name ?? camId}`)
				}
			}))
		})
		toast(`${type === "video" ? "Videos" : "Archives"} queued`)
		setTimeout(() => navigate("/recordings"), 1500)
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

	const startResizeDrag = (e) => {
		e.preventDefault()
		const el = e.currentTarget
		el.setPointerCapture(e.pointerId)
		const startY = e.clientY
		const startH = previewHeight
		const maxH = Math.min(window.innerWidth * 9/16, window.innerHeight * 2/3) / (multiCam ? multiRows : 1)
		const move = (ev) => setPreviewHeight(clamp(startH + ev.clientY - startY, 80, maxH))
		const up = () => {
			el.removeEventListener("pointermove", move)
			el.removeEventListener("pointerup", up)
		}
		el.addEventListener("pointermove", move)
		el.addEventListener("pointerup", up)
	}

	const stopLoading = () => {
		if (multiCam) {
			setCamStates(s => Object.fromEntries(Object.entries(s).map(([id, state]) =>
				[id, { ...state, frames: [], imagesLoaded: 0 }]
			)))
			multiImageCache.current = {}
		} else {
			setFrames([])
			setImagesLoaded(0)
		}
	}

	const multiProgress = () => {
		const vals = Object.values(camStates)
		const total = vals.reduce((a, s) => a + s.frames.length, 0)
		const loaded = vals.reduce((a, s) => a + s.imagesLoaded, 0)
		return total ? Math.round(100 * loaded / total) : 0
	}

	return (
		<div className="flex flex-col gap-0">
			<h1 className="px-2 pt-2 pb-1.5 text-lg font-semibold">clip maker</h1>

			{multiCam ? (
				<>
					<div className="relative w-full grid grid-cols-2 gap-px bg-border" style={{ height: previewHeight * multiRows }}>
						{[0, 1, 2, 3].map(i => {
							const camIdx = selectedCams[i]
							const cam = camIdx !== undefined ? cameras[camIdx] : null
							const camId = cam?.id
							const state = camId ? camStates[camId] : null
							return (
								<div key={i} className={`relative overflow-hidden flex items-center justify-center ${cam ? "bg-black" : "bg-muted/10"}`}>
									{camId && (
										<canvas
											ref={el => { if (el) multiCanvasRefs.current[camId] = el; else delete multiCanvasRefs.current[camId] }}
											width={1920} height={1080}
											style={{
												display: state?.frames?.length > 0 ? "block" : "none",
												maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto"
											}}
										/>
									)}
									{!state?.frames?.length && (
										<ImageOff className="size-4 opacity-20 text-muted" />
									)}
									{state?.fetching && (
										<div className="absolute inset-0 flex items-center justify-center bg-black/40">
											<span className="text-xs text-muted">Loading…</span>
										</div>
									)}
									{cam && (
										<div className="absolute bottom-1 inset-x-0 flex justify-center pointer-events-none">
											<span className="bg-accent/80 text-accent-foreground text-xs px-2 py-0.5 rounded-full">
												{cam.name}
											</span>
										</div>
									)}
								</div>
							)
						})}
					</div>
					<div className="relative w-full h-4 flex items-center cursor-ns-resize touch-none select-none group" onPointerDown={startResizeDrag}>
						<div className="absolute inset-x-0 h-0.5 bg-border group-hover:bg-muted-foreground/40 transition-colors" />
						<div className="absolute right-2 z-10 bg-background">
							<ArrowUpDown className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
						</div>
					</div>
				</>
			) : (
				<>
					<div className="relative bg-black w-full flex items-center justify-center" style={{ height: previewHeight }}>
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
					<div className="relative w-full h-4 flex items-center cursor-ns-resize touch-none select-none group" onPointerDown={startResizeDrag}>
						<div className="absolute inset-x-0 h-0.5 bg-border group-hover:bg-muted-foreground/40 transition-colors" />
						<div className="absolute right-2 z-10 bg-background">
							<ArrowUpDown className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
						</div>
					</div>
				</>
			)}

			<div className="flex flex-col px-8 py-1 gap-1">
				{stoppable ? (
					<div className="flex items-center gap-2">
						<Progress
							value={multiCam ? multiProgress() : Math.round(100 * imagesLoaded / frames.length)}
							className="h-2 flex-1"
						/>
						<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={stopLoading}>
							<Square className="h-4 w-4" />
						</Button>
					</div>
				) : activeFrameCount > 0 ? (
					<CompoundSlider
						frameCount={activeFrameCount}
						scrubIdx={scrubIdx}
						onScrubChange={setScrubIdx}
						trimRange={trimRange}
						onTrimChange={setTrimRange}
						trimming={trimming}
						disabled={loading}
					/>
				) : null}

				{!stoppable && (
					<div className="flex items-center justify-between min-h-[18px]">
						<div className="text-xs text-muted">
							{trimming ? (
								<span>{trimStart.format("MM/DD HH:mm:ss")} → {trimEnd.format("MM/DD HH:mm:ss")}</span>
							) : (scrubTime ?? multiScrubTime) ? (
								<span>{(scrubTime ?? multiScrubTime).format("MM/DD HH:mm:ss")}</span>
							) : null}
						</div>
						{activeFrameCount > 0 && (
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
									Time Zoom
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

			<div className="flex flex-col gap-4 px-2 pt-1 pb-3">
				<div className="flex flex-col gap-1.5">
					<Label>Presets</Label>
					<div className="flex flex-wrap gap-1">
						<Button variant="ghost" size="sm" className="h-8 px-2" onClick={cancelPreset} disabled={!pendingPreset}>
							<X className="size-3" />
						</Button>
						{PRESETS.map(p => {
							const isPending = pendingPreset?.label === p.label
							return (
								<Button key={p.label} variant={isPending ? "default" : "outline"} size="sm" className="h-8 px-3 text-sm"
									onClick={() => isPending ? confirmPreset() : clickPreset(p)}>
									{isPending ? <Check className="size-3" /> : p.label}
								</Button>
							)
						})}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1.5">
						<Label>Camera{multiCam ? "s" : ""}</Label>
						{multiCam && isDesktop ? (
							<div className="flex flex-col gap-1">
								<div className="flex flex-wrap gap-1">
									{cameras.map((cam, i) => {
										const selected = selectedCams.includes(i)
										const atMax = !selected && selectedCams.length >= 4
										return (
											<Button
												key={cam.id}
												size="sm"
												variant={selected ? "default" : "outline"}
												className="h-7 px-2 text-xs"
												disabled={atMax}
												onClick={() => setSelectedCams(s => selected ? s.filter(x => x !== i) : [...s, i])}
											>
												{cam.name}
											</Button>
										)
									})}
									<Button size="sm" variant="ghost" className="h-7 px-2" onClick={toggleMultiCam}>
										<RectangleHorizontal className="size-3" />
									</Button>
								</div>
							</div>
						) : (
							<div className="flex gap-1">
								<Select value={String(camera)} onValueChange={v => setCamera(parseInt(v))}>
									<SelectTrigger><SelectValue placeholder="Select camera" /></SelectTrigger>
									<SelectContent>
										{cameras.map((cam, i) => (
											<SelectItem key={cam.id} value={String(i)}>{cam.name}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{isDesktop && (
									<Button size="icon" variant="ghost" className="shrink-0 size-9" onClick={toggleMultiCam}>
										<LayoutGrid className="size-4" />
									</Button>
								)}
							</div>
						)}
					</div>
					<div className="flex flex-col gap-1.5">
						<Label>Frames</Label>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setNumber(n => Math.max(1, n - 10))}>
								<Minus className="size-4" />
							</Button>
							<Input
								type="number"
								min="1"
								value={number}
								onChange={e => setNumber(Math.max(1, parseInt(e.target.value) || 1))}
								className="flex-1 text-center text-sm font-medium px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							/>
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

				<div className="flex gap-2">
					{isAdmin && (
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="outline" className="flex-1" disabled={!canGenerate}>
								<Save className="size-4" /> Generate
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-xs p-8">
							<DialogHeader>
								<DialogTitle>Generate</DialogTitle>
							</DialogHeader>
							<div className="flex flex-col gap-4">
								<div className="flex flex-col gap-3">
									<div className="flex flex-col gap-1.5">
										<Label>FPS</Label>
										<div className="flex items-center gap-2">
											<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setFps(f => Math.max(1, f - 5))}>
												<Minus className="size-4" />
											</Button>
											<Input
												type="number"
												min="1"
												value={fps}
												onChange={e => setFps(Math.max(1, parseInt(e.target.value) || 1))}
												className="flex-1 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
											/>
											<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setFps(f => f + 5)}>
												<Plus className="size-4" />
											</Button>
										</div>
									</div>
									<div className="flex flex-col gap-1.5">
										<Label>Skip</Label>
										<div className="flex items-center gap-2">
											<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setSkip(s => Math.max(1, s - 1))}>
												<Minus className="size-4" />
											</Button>
											<Input
												type="number"
												min="1"
												value={skip}
												onChange={e => setSkip(Math.max(1, parseInt(e.target.value) || 1))}
												className="flex-1 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
											/>
											<Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setSkip(s => s + 1)}>
												<Plus className="size-4" />
											</Button>
										</div>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Button
										className="bg-accent text-accent-foreground hover:opacity-90"
										onClick={() => generate("video")}
									>
										{generating === "video" ? "Generating…" : multiCam ? `Video ×${selectedCams.length}` : "Video"}
									</Button>
									<Button
										variant="outline"
										onClick={() => generate("zip")}
									>
										{generating === "zip" ? "Generating…" : multiCam ? `Archive ×${selectedCams.length}` : "Archive"}
									</Button>
								</div>
							</div>
						</DialogContent>
					</Dialog>
					)}
					<Button
						variant="outline"
						className="flex-1"
						onClick={multiCam ? loadMultiPreview : confirmPreset}
						disabled={loading || (multiCam && !selectedCams.length)}
					>
						<SkipBack className="size-4" />
						{(fetching || multiAnyFetching) ? "Fetching…" : (downloadingImages || multiAnyDownloading) ? "Loading…" : "Load Images"}
					</Button>
				</div>
			</div>
		</div>
	)
}

export default ClipMaker
