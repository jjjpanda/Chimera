import React, { useMemo, useRef, useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import moment from "moment"
import { RefreshCw, ScanEye, AlertCircle, ImageOff, ArrowUpDown } from "lucide-react"

import useObjectDetections from "../hooks/useObjectDetections.js"
import { useRole } from "./AuthContext.jsx"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import toast from "../js/toast.js"
import { detectGrayPad } from "../js/letterbox.js"
import DetectionOverlay from "../components/DetectionOverlay.jsx"

const cameraName = (status, n) => status?.cameraNames?.[n] || `Camera ${n}`

const groupDetections = (detections) => {
	const byImage = new Map()
	for (const d of detections) {
		if (!d.image || !Array.isArray(d.box)) continue
		if (!byImage.has(d.image)) byImage.set(d.image, { image: d.image, camera: d.camera, time: d.timestamp, boxes: [] })
		byImage.get(d.image).boxes.push(d)
	}
	return [...byImage.values()].sort((a, b) => new Date(b.time) - new Date(a.time))
}

const DetectionImage = ({ image, boxes, cover = false, height }) => {
	const [dims, setDims] = useState({ w: 416, h: 416 })
	const [pad, setPad] = useState({ top: 0, bot: 0, left: 0, right: 0 })

	const handleLoad = (e) => {
		const img = e.target
		setDims({ w: img.naturalWidth || 416, h: img.naturalHeight || 416 })
		setPad(detectGrayPad(img))
	}

	const contentW = dims.w - pad.left - pad.right
	const contentH = dims.h - pad.top - pad.bot

	if (cover) {
		return (
			<div className="relative w-full h-full overflow-hidden">
				<img
					src={`/object/captures/${image}`}
					alt="detection"
					className="absolute inset-0 w-full h-full object-cover object-top"
					onLoad={handleLoad}
				/>
				<DetectionOverlay boxes={boxes} dims={dims} pad={pad} fit="xMidYMin slice" />
			</div>
		)
	}

	return (
		<div
			className="relative w-full overflow-hidden rounded-md bg-surface-raised"
			style={{
				aspectRatio: `${contentW} / ${contentH}`,
				...(height != null ? { maxHeight: height, maxWidth: contentH > 0 ? height * contentW / contentH : undefined, margin: "0 auto" } : {})
			}}
		>
			<img
				src={`/object/captures/${image}`}
				alt="detection"
				className="absolute"
				style={{
					width: `${(dims.w / contentW) * 100}%`,
					height: "auto",
					left: pad.left > 0 ? `-${(pad.left / contentW) * 100}%` : 0,
					top: pad.top > 0 ? `-${(pad.top / contentH) * 100}%` : 0
				}}
				onLoad={handleLoad}
			/>
			<DetectionOverlay boxes={boxes} dims={dims} pad={pad} fit="none" />
		</div>
	)
}

const ObjectDetectionsMini = () => {
	const navigate = useNavigate()
	const { detections, status } = useObjectDetections()
	const groups = useMemo(() => groupDetections(detections), [detections])

	const lastPerCamera = useMemo(() => {
		const seen = new Set()
		const result = []
		for (const g of groups) {
			if (!seen.has(g.camera)) { seen.add(g.camera); result.push(g) }
		}
		return result.slice(0, 4)
	}, [groups])

	const slots = [0, 1, 2, 3].map(i => lastPerCamera[i] ?? null)

	return (
		<Card className="h-full overflow-hidden cursor-pointer select-none transition-shadow" onClick={() => navigate("/objects")}>
			<div className="relative flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-border min-h-0 h-full">
				{slots.map((g, i) => (
					<div
						key={i}
						onClick={g ? (e) => { e.stopPropagation(); navigate(`/objects?camera=${g.camera}`) } : undefined}
						className={`relative overflow-hidden ${g ? "bg-black" : "bg-muted/20"}`}
					>
						{g ? (
							<DetectionImage key={g.image} image={g.image} boxes={g.boxes} cover />
						) : (
							<div className="absolute inset-0 flex items-center justify-center">
								<ImageOff className="size-5 opacity-30 text-muted" />
							</div>
						)}
						{g && (
							<div className="absolute bottom-1.5 inset-x-0 flex justify-center pointer-events-none">
								<span className="bg-accent/85 text-accent-foreground text-xs font-medium px-3 py-0.5 rounded-full">
									{cameraName(status, g.camera)}
								</span>
							</div>
						)}
					</div>
				))}
				<div className="absolute inset-0 m-auto z-10 rounded-full shadow-lg size-14 flex items-center justify-center bg-accent text-accent-foreground" onClick={(e) => { e.stopPropagation(); navigate("/objects") }}>
					<ScanEye className="size-6" />
				</div>
			</div>
		</Card>
	)
}

const ObjectDetectionsFull = () => {
	const role = useRole()
	const { status, detections, loadStatus, loadDetections, scan } = useObjectDetections()
	const groups = useMemo(() => groupDetections(detections), [detections])

	const [searchParams] = useSearchParams()
	const cameras = status?.cameras ? Object.entries(status.cameras) : []
	const [selectedCam, setSelectedCam] = useState(null)
	const [scrubIdx, setScrubIdx] = useState(0)
	const [previewHeight, setPreviewHeight] = useState(200)
	const trackRef = useRef(null)

	const startResizeDrag = (e) => {
		e.preventDefault()
		const el = e.currentTarget
		el.setPointerCapture(e.pointerId)
		const startY = e.clientY
		const startH = previewHeight
		const maxH = Math.min(window.innerWidth * 9 / 16, window.innerHeight * 2 / 3)
		const move = (ev) => setPreviewHeight(Math.max(80, Math.min(maxH, startH + ev.clientY - startY)))
		const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up) }
		el.addEventListener("pointermove", move)
		el.addEventListener("pointerup", up)
	}

	useEffect(() => {
		if (selectedCam != null || cameras.length === 0) return
		const camParam = searchParams.get("camera")
		const match = camParam != null && cameras.find(([c]) => String(c) === String(camParam))
		setSelectedCam(match ? match[0] : null)
	}, [cameras])

	const camGroups = useMemo(() =>
		groups.filter(g => String(g.camera) === String(selectedCam)).reverse(),
	[groups, selectedCam]
	)

	const positionedCam = useRef(null)
	useEffect(() => {
		if (camGroups.length === 0) return
		if (positionedCam.current !== selectedCam) {
			positionedCam.current = selectedCam
			setScrubIdx(camGroups.length - 1)
		} else {
			setScrubIdx((i) => Math.min(i, camGroups.length - 1))
		}
	}, [selectedCam, camGroups.length])

	const currentGroup = camGroups[scrubIdx] ?? null
	const scrubPct = camGroups.length > 1 ? (scrubIdx / (camGroups.length - 1)) * 100 : 0

	const seekTo = (clientX) => {
		const rect = trackRef.current?.getBoundingClientRect()
		if (!rect) return
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		setScrubIdx(Math.round(pct * Math.max(0, camGroups.length - 1)))
	}

	const startDrag = (e) => {
		e.preventDefault()
		seekTo(e.clientX)
		const move = (ev) => seekTo(ev.clientX)
		const up = () => {
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", up)
		}
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", up)
	}

	const runScan = (camera) => {
		toast(`Scanning camera ${camera}…`)
		scan(camera, (res) => {
			const n = res?.detections?.length ?? 0
			toast(n ? `Camera ${camera}: ${n} detection(s)` : `Camera ${camera}: nothing found`)
			loadStatus()
			loadDetections()
		})
	}

	const config = status?.config
	const camStatus = selectedCam != null ? status?.cameras?.[selectedCam] : null

	return (
		<div className="flex flex-col gap-0">
			<div className="flex items-center justify-between px-2 pt-2 pb-1.5">
				<h1 className="text-lg font-semibold">object detection</h1>
				<Button variant="ghost" size="sm" onClick={() => { loadStatus(); loadDetections() }}>
					<RefreshCw className="size-4" />
				</Button>
			</div>

			{currentGroup ? (
				<DetectionImage key={currentGroup.image} image={currentGroup.image} boxes={currentGroup.boxes} height={previewHeight} />
			) : (
				<div className="flex items-center justify-center bg-muted/10" style={{ height: previewHeight }}>
					<ImageOff className="size-8 opacity-20 text-muted" />
				</div>
			)}
			<div className="relative w-full h-4 flex items-center cursor-ns-resize touch-none select-none group" onPointerDown={startResizeDrag}>
				<div className="absolute inset-x-0 h-0.5 bg-border group-hover:bg-muted/40 transition-colors" />
				<div className="absolute right-2 z-10 bg-bg">
					<ArrowUpDown className="size-3 text-muted/60 group-hover:text-muted transition-colors" />
				</div>
			</div>

			{camGroups.length > 1 && (
				<div className="px-8 pt-1 pb-0">
					<div
						ref={trackRef}
						className="relative h-12 flex items-center select-none cursor-pointer"
						onPointerDown={startDrag}
					>
						<div className="absolute inset-x-0 h-3 bg-secondary rounded-full" />
						<div
							className="absolute w-6 h-6 rounded-full bg-primary ring-2 ring-accent shadow-lg touch-none"
							style={{ left: `${scrubPct}%`, transform: "translateX(-50%)" }}
						/>
					</div>
					<div className="flex justify-between text-[11px] text-muted -mt-1 pb-1">
						<span>{currentGroup ? moment(currentGroup.time).format("MM/DD HH:mm:ss") : ""}</span>
						<span>{scrubIdx + 1} / {camGroups.length}</span>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-3 px-2 py-3">
				{camStatus && (
					<div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
						<div className="text-[11px] text-muted">
							{camStatus.error
								? <span className="inline-flex items-center gap-1 text-danger"><AlertCircle className="size-3" />{camStatus.error}</span>
								: camStatus.lastRun ? `ran ${moment(camStatus.lastRun).fromNow()}` : "idle"}
						</div>
						{role === "admin" && (
							<Button variant="secondary" size="sm" onClick={() => runScan(Number(selectedCam))}>Scan</Button>
						)}
					</div>
				)}
				{config && (
					<div className="flex flex-wrap gap-1.5">
						<Badge variant="outline">confidence {config.confidence}</Badge>
						<Badge variant="outline">every {config.intervalMs}ms</Badge>
						{(config.classes || []).length > 0 && (
							<Badge variant="outline">classes: {config.classes.join(", ")}</Badge>
						)}
					</div>
				)}
				{cameras.length === 0 && (
					<span className="text-xs text-muted">No active workers (detection runs on the prime instance only).</span>
				)}
			</div>

			{cameras.length > 0 && (
				<div className="flex flex-wrap gap-1 px-2 pb-2">
					{cameras.map(([cam]) => (
						<Button key={cam} size="sm"
							variant={selectedCam === cam ? "default" : "outline"}
							className="h-7 px-2 text-xs"
							onClick={() => setSelectedCam(cam)}>
							{cameraName(status, cam)}
						</Button>
					))}
				</div>
			)}
		</div>
	)
}

const ObjectDetections = ({ mini }) => mini ? <ObjectDetectionsMini /> : <ObjectDetectionsFull />

export default ObjectDetections
