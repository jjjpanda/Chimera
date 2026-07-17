import React, { useState, useMemo, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useRole } from "./AuthContext"
import { ImageOff, Square, Minus, Plus, ZoomIn, Check, X, Rewind, LayoutGrid, RectangleHorizontal, Save, SkipBack, ScanEye } from "lucide-react"
import { useMediaQuery } from "react-responsive"
import useCameras from "../hooks/useCameras"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { Input } from "../components/ui/input"
import { Progress } from "../components/ui/progress"
import { Switch } from "../components/ui/switch"
import { request, jsonProcessing } from "../js/request"
import { detectGrayPad } from "../js/letterbox.js"
import DetectionOverlay from "../components/DetectionOverlay.jsx"
import ResizeHandle from "../components/ResizeHandle.jsx"
import CameraGridMini from "../components/CameraGridMini.jsx"
import usePreviewHeight from "../hooks/usePreviewHeight"
import { padSlots, gridShape } from "../js/grid.js"
import { nearestFrameIndex, frameSpacingMs, boxesForScrub, fuseMarkers } from "../js/detections.js"
import toast from "../js/toast"
import moment from "moment"

const DETECT_INPUT = 416  // YOLOX letterbox square; detection boxes are in this pixel space
const FUSE_PCT = 1.5  // detection ticks closer than this (% of track) fuse into a band
const MAX_CONCURRENT_DECODES = 24  // per camera; caps simultaneous Image decodes for large frame ranges

const PRESETS = [
	{ label: "30m", value: 30, unit: "minutes" },
	{ label: "1h",  value: 1,  unit: "hours" },
	{ label: "4h",  value: 4,  unit: "hours" },
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

const CompoundSlider = ({ frameCount, scrubIdx, onScrubChange, trimRange, onTrimChange, trimming, disabled, markers = [] }) => {
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
			<div className="absolute inset-x-0 h-5 rounded-full overflow-hidden">
				<div className="absolute inset-0 bg-secondary" />
				{markers.map((m, i) => m.end > m.start ? (
					<div
						key={i}
						className="absolute h-full bg-[#34d399]/70 pointer-events-none"
						style={{ left: `${m.start}%`, width: `${m.end - m.start}%` }}
					/>
				) : (
					<div
						key={i}
						className="absolute h-full w-0.5 bg-[#34d399] pointer-events-none"
						style={{ left: `${m.start}%`, transform: "translateX(-50%)" }}
					/>
				))}
				{trimming && (
					<div
						className="absolute inset-y-0 bg-accent/15 pointer-events-none"
						style={{ left: `${ts}%`, width: `${te - ts}%` }}
					/>
				)}
			</div>

			{trimming && (
				<>
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

	const slots = padSlots(cameras.slice(0, 4))

	return (
		<CameraGridMini
			slots={slots}
			onActivate={() => navigate("/clip")}
			onCellClick={cam => navigate(`/clip?camera=${cam.id}`)}
			cellLabel={cam => cam.name}
			centerIcon={<Rewind className="size-6" />}
			renderCell={cam => snapshots[cam.id]
				? <img src={snapshots[cam.id]} className="w-full h-full object-cover" alt={cam.name} />
				: <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="size-5 opacity-30 text-muted" /></div>}
		/>
	)
}

const ClipMakerFull = () => {
	const isDesktop = useMediaQuery({ query: "(min-width: 601px)" })
	const role = useRole()
	const isAdmin = role === "admin"
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const [cameras] = useCameras()

	const [camera, setCamera] = useState(null)
	const [startDate, setStartDate] = useState(moment().subtract(4, "hours"))
	const [endDate, setEndDate] = useState(moment())
	const [number, setNumber] = useState(10)
	const [fps, setFps] = useState(20)
	const [skip, setSkip] = useState(1)
	const [scrubIdx, setScrubIdx] = useState(0)
	const [trimRange, setTrimRange] = useState([0, 100])
	const [trimming, setTrimming] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [pendingPreset, setPendingPreset] = useState(null)
	const [savedDates, setSavedDates] = useState(null)
	const [loadedParams, setLoadedParams] = useState(null) // {start,end,number,cams} of the last load; current inputs diverging = stale
	const [showBoxes, setShowBoxes] = useState(false)
	const [multiCam, setMultiCam] = useState(false) // UI layout only: selector style + labels; data is always cams[]
	const [selectedCams, setSelectedCams] = useState([]) // camera indices, up to 4

	// one entry per active camera; single-cam = length 1
	const [cams, setCams] = useState([]) // { id, idx, name, frames, imagesLoaded, fetching, generating, detections, contentPad, dims }

	const canvasRefs = useRef({})  // { [camId]: canvas element }
	const imageCaches = useRef({}) // { [camId]: { [url]: Image } }
	const decodeGen = useRef(0)    // bumped on every reset — must only ever climb, or stale settles pass the check
	const startedFrames = useRef({}) // { [camId]: frames array already queued } — skips cams unaffected by this render
	const decodeTimers = useRef({}) // { [camId]: timer[] } — watchdogs for that cam's in-flight decodes
	const padLoading = useRef({})  // { [camId]: bool } — a contentPad measure is in flight
	const loadSeq = useRef(0)      // cancels stale network responses
	const navTimer = useRef(null)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			Object.values(decodeTimers.current).forEach(ts => ts.forEach(clearTimeout))
		}
	}, [])

	const resetDecodes = () => {
		Object.values(decodeTimers.current).forEach(ts => ts.forEach(clearTimeout))
		decodeTimers.current = {}
		imageCaches.current = {}
		startedFrames.current = {}
		decodeGen.current++
	}

	const activeIdxs = multiCam ? selectedCams : (camera != null ? [camera] : [])

	const timeline = useMemo(() => {
		const views = cams.map(c => {
			const timesMs = c.frames.map(u => { const t = parseFrameTime(u); return t ? t.valueOf() : null })
			return { timesMs, tol: frameSpacingMs(timesMs) }
		})
		const frameCount = Math.max(0, ...cams.map(c => c.frames.length))
		let refIdx = 0
		cams.forEach((c, i) => { if (c.frames.length > (cams[refIdx]?.frames.length ?? 0)) refIdx = i })
		return { views, frameCount, refTimesMs: views[refIdx]?.timesMs ?? [] }
	}, [cams])
	const { views: camViews, frameCount, refTimesMs } = timeline

	const scrubMs = frameCount > 0
		? (refTimesMs[scrubIdx] ?? lerp(startDate, endDate, frameCount > 1 ? scrubIdx / (frameCount - 1) : 0).valueOf())
		: null

	const timeAtPct = (p) => {
		if (frameCount > 0) {
			const t = refTimesMs[Math.round(p / 100 * (frameCount - 1))]
			if (t != null) return moment(t)
		}
		return lerp(startDate, endDate, p / 100)
	}
	const trimStart = timeAtPct(trimRange[0])
	const trimEnd = timeAtPct(trimRange[1])
	const scrubTime = scrubMs != null ? moment(scrubMs) : null

	const boxesForCam = (ci) => {
		const c = cams[ci]
		if (!showBoxes || !c || !c.detections.length || !c.frames.length) return []
		const { timesMs, tol } = camViews[ci]
		return boxesForScrub(c.detections, timesMs, nearestFrameIndex(timesMs, scrubMs), tol)
	}

	const detectionMarkers = useMemo(() => {
		if (frameCount === 0) return []
		const pcts = []
		cams.forEach((c, ci) => {
			const { tol } = camViews[ci]
			c.detections.forEach(d => {
				const v = moment(d.timestamp).valueOf()
				if (!Number.isFinite(v)) return
				const idx = nearestFrameIndex(refTimesMs, v)
				const ft = refTimesMs[idx]
				if (ft == null || Math.abs(ft - v) > tol) return
				pcts.push((idx / Math.max(1, frameCount - 1)) * 100)
			})
		})
		pcts.sort((a, b) => a - b)
		return fuseMarkers(pcts, FUSE_PCT)
	}, [cams, camViews, refTimesMs, frameCount])

	const anyFetching = cams.some(c => c.fetching)
	const anyDownloading = cams.some(c => c.frames.length > 0 && c.imagesLoaded < c.frames.length)
	const anyGenerating = cams.some(c => c.generating)
	const hasLoadedFrames = cams.some(c => c.frames.length > 0)
	const loading = anyFetching || anyDownloading
	const stoppable = anyDownloading

	const currentCamIds = activeIdxs.map(i => cameras[i]?.id).filter(id => id != null).sort()
	const paramsStale = !!loadedParams && hasLoadedFrames && (
		!startDate.isSame(loadedParams.start) ||
		!endDate.isSame(loadedParams.end) ||
		number !== loadedParams.number ||
		currentCamIds.join(",") !== loadedParams.cams.join(",")
	)
	const canGenerate = !submitting && !paramsStale && !loading && !anyGenerating &&
		startDate.isBefore(endDate) && activeIdxs.length > 0

	const totalFrames = cams.reduce((a, c) => a + c.frames.length, 0)
	const loadedFrames = cams.reduce((a, c) => a + c.imagesLoaded, 0)
	const progress = totalFrames ? Math.round(100 * loadedFrames / totalFrames) : 0

	const previewCells = cams.length
		? cams
		: activeIdxs.map(i => cameras[i]).filter(Boolean).map(cam =>
			({ id: cam.id, name: cam.name, frames: [], imagesLoaded: 0, fetching: false, detections: [], contentPad: null, dims: null }))
	const cells = previewCells.length ? previewCells : [null]
	const { cols, rows } = gridShape(cells.length)
	const [previewHeight, , startResizeDrag] = usePreviewHeight(240, { rows })

	useEffect(() => {
		if (!isDesktop && multiCam) toggleMultiCam()
	}, [isDesktop])

	useEffect(() => () => { if (navTimer.current) clearTimeout(navTimer.current) }, [])

	useEffect(() => {
		if (!multiCam && camera != null && cameras.length > 0 && cams.length === 0 && !anyFetching) loadPreview(undefined, undefined, [camera])
	}, [cameras])

	useEffect(() => {
		if (multiCam || cameras.length === 0 || camera != null) return
		const camParam = searchParams.get("camera")
		if (camParam == null) return
		const idx = cameras.findIndex(c => String(c.id) === String(camParam))
		if (idx < 0) return
		setCamera(idx)
		loadPreview(undefined, undefined, [idx])
	}, [cameras])

	const framesKey = useMemo(() => cams.map(c => `${c.id}:${c.frames.join(",")}`).join("|"), [cams])
	useEffect(() => {
		cams.forEach(c => {
			if (startedFrames.current[c.id] === c.frames) return
			startedFrames.current[c.id] = c.frames
			const cache = imageCaches.current[c.id] || (imageCaches.current[c.id] = {})
			const newUrls = c.frames.filter(u => !cache[u])
			if (!newUrls.length) return
			const gen = decodeGen.current
			decodeTimers.current[c.id]?.forEach(clearTimeout)
			const timers = decodeTimers.current[c.id] = []
			let next = 0
			const startNext = () => {
				if (!mounted.current || next >= newUrls.length || decodeGen.current !== gen) return
				const url = newUrls[next++]
				const img = new Image()
				let settled = false, timer
				const settle = () => {
					if (settled || decodeGen.current !== gen) return
					settled = true
					clearTimeout(timer)
					setCams(prev => prev.map(pc => pc.id === c.id ? { ...pc, imagesLoaded: pc.imagesLoaded + 1 } : pc))
					startNext()
				}
				img.onload = img.onerror = settle
				timer = setTimeout(settle, 10000)
				timers.push(timer)
				img.src = url
				cache[url] = img
			}
			for (let i = 0; i < Math.min(MAX_CONCURRENT_DECODES, newUrls.length); i++) startNext()
		})
	}, [framesKey])

	// measure each camera's letterbox pad once from a detection capture (constant per camera), so
	// boxes map per-axis; the feed's aspect sets the content region and differs from the frame's.
	useEffect(() => {
		cams.forEach(c => {
			if (c.contentPad || padLoading.current[c.id] || !c.detections.length) return
			const d = c.detections.find(d => d.image && d.camera != null)
			if (!d) return
			padLoading.current[c.id] = true
			const im = new Image()
			im.onload = () => { padLoading.current[c.id] = false; setCams(prev => prev.map(pc => pc.id === c.id ? { ...pc, contentPad: detectGrayPad(im) } : pc)) }
			im.onerror = () => { padLoading.current[c.id] = false }
			im.src = `/object/captures/${d.image}`
		})
	}, [cams])

	// draw each camera's frame nearest the scrub time onto its canvas
	useEffect(() => {
		if (frameCount === 0) return
		cams.forEach((c, ci) => {
			const canvas = canvasRefs.current[c.id]
			if (!canvas || !c.frames.length) return
			const img = imageCaches.current[c.id]?.[c.frames[nearestFrameIndex(camViews[ci].timesMs, scrubMs)]]
			if (!img?.complete || !img.naturalWidth) return
			if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
				canvas.width = img.naturalWidth
				canvas.height = img.naturalHeight
			}
			if (c.dims?.w !== img.naturalWidth || c.dims?.h !== img.naturalHeight) {
				setCams(prev => prev.map(pc => pc.id === c.id ? { ...pc, dims: { w: img.naturalWidth, h: img.naturalHeight } } : pc))
			}
			canvas.getContext("2d").drawImage(img, 0, 0)
		})
	}, [scrubIdx, cams, frameCount, camViews, scrubMs])

	const toggleMultiCam = () => {
		setMultiCam(m => !m)
		setSelectedCams([])
		setCams([])
		resetDecodes()
		padLoading.current = {}
		setLoadedParams(null)
		setTrimRange([0, 100])
		setTrimming(false)
		setScrubIdx(0)
	}

	const loadDetections = (camId, start, end, seq) => {
		const qs = new URLSearchParams({
			camera: String(camId),
			start: moment(start).toISOString(),
			end: moment(end).toISOString(),
			limit: "500",
		})
		request(`/object/detections?${qs}`, { cache: "no-store" }, prom =>
			jsonProcessing(prom, data => {
				if (seq !== loadSeq.current) return
				setCams(prev => prev.map(c => c.id === camId ? { ...c, detections: Array.isArray(data) ? data : [] } : c))
			}))
	}

	const framesBody = (camId, start, end) => JSON.stringify({
		camera: String(camId),
		start: moment(start).utc().format("YYYYMMDD-HHmmss"),
		end: moment(end).utc().format("YYYYMMDD-HHmmss"),
		frames: number
	})

	const createBody = (camId, type) => JSON.stringify({
		camera: String(camId),
		start: moment(trimStart).utc().format("YYYYMMDD-HHmmss"),
		end: moment(trimEnd).utc().format("YYYYMMDD-HHmmss"),
		save: true,
		...(type === "video" ? { fps, skip } : { skip })
	})

	const loadPreview = (overrideStart, overrideEnd, idxs = activeIdxs) => {
		if (loading) return
		const ids = idxs.map(i => cameras[i]?.id)
		if (!ids.length || ids.some(id => id == null)) return toast("No camera selected")
		const start = moment(overrideStart ?? startDate)
		const end   = moment(overrideEnd   ?? endDate)
		setLoadedParams({ start, end, number, cams: [...ids].sort() })
		resetDecodes()
		padLoading.current = {}
		setScrubIdx(0)
		setTrimRange([0, 100])
		setTrimming(false)
		setCams(idxs.map(i => ({
			id: cameras[i].id, idx: i, name: cameras[i].name,
			frames: [], imagesLoaded: 0, fetching: true, generating: null,
			detections: [], contentPad: null, dims: null
		})))
		const seq = ++loadSeq.current
		idxs.forEach(i => {
			const camId = cameras[i].id
			loadDetections(camId, start, end, seq)
			request("/convert/listFramesVideo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: framesBody(camId, start, end)
			}, prom => jsonProcessing(prom, data => {
				if (seq !== loadSeq.current) return
				setCams(prev => prev.map(c => c.id === camId ? { ...c, frames: data?.list ?? [], fetching: false } : c))
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
		const ids = activeIdxs.map(i => cameras[i]?.id)
		if (!ids.length || ids.some(id => id == null)) return toast("No camera selected")
		setSubmitting(true)
		setCams(prev => prev.map(c => ids.includes(c.id) ? { ...c, generating: type } : c))
		const endpoint = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		const total = ids.length
		let done = 0, failed = 0, lastFail = null
		ids.forEach(camId => {
			request(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: createBody(camId, type)
			}, prom => jsonProcessing(prom, data => {
				setCams(prev => prev.map(c => c.id === camId ? { ...c, generating: null } : c))
				done++
				if (!data || data.error || !data.url) {
					failed++
					lastFail = data
					if (total > 1) toast(`Failed: ${cameras.find(c => c.id === camId)?.name ?? camId}`)
				}
				if (done < total) return
				if (failed === total) {
					setSubmitting(false)
					toast(total === 1 && lastFail && !lastFail.error && !lastFail.url ? "No frames found" : "Generation failed")
				} else {
					const noun = type === "video" ? "Video" : "Archive"
					toast(`${total > 1 ? noun + "s" : noun} queued`)
					navTimer.current = setTimeout(() => navigate("/recordings"), 1500)
				}
			}))
		})
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

	const stopLoading = () => {
		setCams(prev => prev.map(c => ({ ...c, frames: [], imagesLoaded: 0, dims: null })))
		resetDecodes()
	}

	return (
		<div className="flex flex-col gap-0">
			<h1 className="px-2 pt-2 pb-1.5 text-lg font-semibold">clip maker</h1>

			<div
				className="relative w-full grid gap-px bg-border overflow-hidden"
				style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, height: previewHeight * rows }}
			>
				{cells.map((c, i) => {
					const boxes = c ? boxesForCam(i) : []
					return (
						<div
							key={c ? c.id : "empty"}
							className="relative overflow-hidden grid place-items-center bg-black"
							style={{ gridTemplate: "100% / 100%" }}
						>
							{c ? (
								<>
									<canvas
										ref={el => { if (el) canvasRefs.current[c.id] = el; else delete canvasRefs.current[c.id] }}
										width={640}
										height={360}
										className="[grid-area:1/1]"
										style={{ display: c.frames.length > 0 ? "block" : "none", maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" }}
									/>
									{showBoxes && c.contentPad && c.dims && boxes.length > 0 && (
										<DetectionOverlay
											boxes={boxes}
											dims={{ w: DETECT_INPUT, h: DETECT_INPUT }}
											pad={c.contentPad}
											fit="none"
											className="pointer-events-none [grid-area:1/1]"
											style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" }}
											width={c.dims.w}
											height={c.dims.h}
										/>
									)}
									{c.frames.length === 0 && !c.fetching && (
										<ImageOff className="h-10 w-10 opacity-40 text-muted [grid-area:1/1]" />
									)}
									{c.fetching && (
										<div className="absolute inset-0 flex items-center justify-center bg-black/40">
											<span className="text-xs text-muted">Loading…</span>
										</div>
									)}
									{cells.length > 1 && (
										<div className="absolute bottom-1 inset-x-0 flex justify-center pointer-events-none">
											<span className="bg-accent/80 text-accent-foreground text-xs px-2 py-0.5 rounded-full">
												{c.name}
											</span>
										</div>
									)}
								</>
							) : (
								<ImageOff className="h-10 w-10 opacity-40 text-muted [grid-area:1/1]" />
							)}
						</div>
					)
				})}
			</div>
			<ResizeHandle onPointerDown={startResizeDrag} />

			<div className="flex flex-col px-8 py-1 gap-1">
				{stoppable ? (
					<div className="flex items-center gap-2">
						<Progress value={progress} className="h-2 flex-1" />
						<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={stopLoading}>
							<Square className="h-4 w-4" />
						</Button>
					</div>
				) : frameCount > 0 ? (
					<CompoundSlider
						frameCount={frameCount}
						scrubIdx={scrubIdx}
						onScrubChange={setScrubIdx}
						trimRange={trimRange}
						onTrimChange={setTrimRange}
						trimming={trimming}
						disabled={loading}
						markers={detectionMarkers}
					/>
				) : null}

				{!stoppable && (
					<div className="flex items-center justify-between min-h-[18px]">
						<div className="text-xs text-muted">
							{trimming ? (
								<span>{trimStart.format("MM/DD HH:mm:ss")} → {trimEnd.format("MM/DD HH:mm:ss")}</span>
							) : scrubTime ? (
								<span>{scrubTime.format("MM/DD HH:mm:ss")}</span>
							) : null}
						</div>
						{frameCount > 0 && (
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
								<div className="flex items-center gap-2">
									{cams.some(c => c.detections.length > 0) && (
										<div
											onClick={() => setShowBoxes(v => !v)}
											className="flex items-center gap-1 cursor-pointer select-none text-xs text-muted"
										>
											<ScanEye className="size-3.5" />
											Boxes
											<Switch checked={showBoxes} className="pointer-events-none" />
										</div>
									)}
									<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setTrimming(true)}>
										<ZoomIn className="size-3" />
										Time Zoom
									</Button>
								</div>
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
									<Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Switch to single camera" onClick={toggleMultiCam}>
										<RectangleHorizontal className="size-3" />
									</Button>
								</div>
							</div>
						) : (
							<div className="flex gap-1">
								<Select value={camera == null ? "" : String(camera)} onValueChange={v => setCamera(parseInt(v))}>
									<SelectTrigger><SelectValue placeholder="Select camera" /></SelectTrigger>
									<SelectContent>
										{cameras.map((cam, i) => (
											<SelectItem key={cam.id} value={String(i)}>{cam.name}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{isDesktop && (
									<Button size="icon" variant="ghost" className="shrink-0 size-9" aria-label="Switch to multi-camera" onClick={toggleMultiCam}>
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

				<div className="flex flex-col gap-3 p-2 bg-muted/5 border border-border/50 rounded-lg">
					<div className="flex flex-col gap-1">
						<Label>Time Range</Label>
						<div className="flex items-center gap-2 justify-end flex-wrap">
							<span className="text-xs text-muted/50">preset</span>
							<Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={cancelPreset} disabled={!pendingPreset}>
								<X className="size-3" />
							</Button>
							<div className="flex flex-wrap gap-1">
								{PRESETS.map(p => {
									const isPending = pendingPreset?.label === p.label
									return (
										<Button key={p.label} variant={isPending ? "default" : "outline"} size="sm" className="h-7 px-2.5 relative"
											onClick={() => isPending ? confirmPreset() : clickPreset(p)}>
											<span className={isPending ? "invisible" : ""}>{p.label}</span>
											{isPending && <Check className="size-3 absolute" />}
										</Button>
									)
								})}
							</div>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-x-3 gap-y-2">
						<Label className="text-xs">Start</Label>
						<Label className="text-xs">End</Label>
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
								<Button
									variant="outline"
									className="flex-1"
									disabled={!canGenerate}
									title={paramsStale ? "Reload images to apply the changed camera/range/frames" : undefined}
								>
									<Save className="size-4" /> Generate
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-xs p-8">
								<DialogHeader>
									<DialogTitle>Generate</DialogTitle>
								</DialogHeader>
								<div className="flex flex-col gap-4">
									<div className="flex flex-col gap-3">
										<div className="flex items-center justify-between gap-4">
											<Label>FPS</Label>
											<div className="flex items-center gap-2">
												<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setFps(f => Math.max(1, f - 5))}>
													<Minus className="size-4" />
												</Button>
												<Input
													type="number"
													min="1"
													value={fps}
													onChange={e => setFps(Math.max(1, parseInt(e.target.value) || 1))}
													className="w-16 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
												/>
												<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setFps(f => f + 5)}>
													<Plus className="size-4" />
												</Button>
											</div>
										</div>
										<div className="flex items-center justify-between gap-4">
											<Label>Skip</Label>
											<div className="flex items-center gap-2">
												<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setSkip(s => Math.max(1, s - 1))}>
													<Minus className="size-4" />
												</Button>
												<Input
													type="number"
													min="1"
													value={skip}
													onChange={e => setSkip(Math.max(1, parseInt(e.target.value) || 1))}
													className="w-16 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
												/>
												<Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => setSkip(s => s + 1)}>
													<Plus className="size-4" />
												</Button>
											</div>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<Button
											className="bg-accent text-accent-foreground hover:opacity-90"
											disabled={!canGenerate}
											onClick={() => generate("video")}
										>
											{anyGenerating ? "Generating…" : activeIdxs.length > 1 ? `Video ×${activeIdxs.length}` : "Video"}
										</Button>
										<Button
											variant="outline"
											disabled={!canGenerate}
											onClick={() => generate("zip")}
										>
											{anyGenerating ? "Generating…" : activeIdxs.length > 1 ? `Archive ×${activeIdxs.length}` : "Archive"}
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					)}
					<Button
						variant="outline"
						className={`flex-1 ${paramsStale ? "ring-1 ring-accent text-accent" : ""}`}
						onClick={confirmPreset}
						disabled={loading || activeIdxs.length === 0}
					>
						<SkipBack className="size-4" />
						{anyFetching ? "Fetching…" : anyDownloading ? "Loading…" : hasLoadedFrames ? "Reload Images" : "Load Images"}
					</Button>
				</div>
				{paramsStale && (
					<p className="-mt-2 text-xs text-amber-500/90">camera, range, or frame count changed — reload images to apply.</p>
				)}
			</div>
		</div>
	)
}

const ClipMaker = ({ mini } = {}) => mini ? <ClipMakerMini /> : <ClipMakerFull />

export default ClipMaker
