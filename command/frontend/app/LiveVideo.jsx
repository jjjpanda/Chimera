import React, { useState, useEffect, useRef } from "react"
import Hls from "hls.js"
import useLiveVideo from "../hooks/useLiveVideo.js"
import useCameras from "../hooks/useCameras.js"
import useSquarifyVideos from "../hooks/useSquarifyVideo.js"
import NavigateToRoute from "./NavigateToRoute.jsx"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { Button } from "../components/ui/button"
import { RefreshCw } from "lucide-react"
import { cn } from "../lib/utils"

const HlsPlayer = ({ src, className }) => {
	const videoRef = useRef(null)
	const [unsupported] = useState(
		() => !Hls.isSupported() && !document.createElement("video").canPlayType("application/vnd.apple.mpegurl")
	)

	useEffect(() => {
		const video = videoRef.current
		if (!video || !src) return

		if (video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = src
			return () => {
				video.pause()
				video.removeAttribute("src")
				video.load()
			}
		}

		if (Hls.isSupported()) {
			const hls = new Hls()
			hls.on(Hls.Events.ERROR, (_, data) => {
				if (!data.fatal) return
				if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
				else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
				else hls.destroy()
			})
			hls.loadSource(src)
			hls.attachMedia(video)
			return () => hls.destroy()
		}
	}, [src])

	if (unsupported)
		return <div className={cn(className, "flex items-center justify-center text-sm text-muted")}>HLS not supported</div>

	return <video ref={videoRef} controls playsInline className={className} />
}

const Feed = ({ video, hideLabel }) => (
	<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
		<HlsPlayer src={video.url} className="absolute inset-0 h-full w-full object-contain" />
		{!hideLabel && (
			<div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-0.5 backdrop-blur-sm">
				<span className={cn("size-2 rounded-full shrink-0", video.online ? "bg-emerald-500" : "bg-danger")} />
				<span className="text-sm font-medium text-white">{video.camera}</span>
			</div>
		)}
	</div>
)

const LiveVideo = (props) => {
	const [cameras] = useCameras()
	const [state, refresh, restart] = useLiveVideo(cameras)
	const [videos, setVideos] = useState([])
	const [activeTab, setActiveTab] = useState("0")
	const squarify = useSquarifyVideos()

	useEffect(() => {
		setVideos(props.grid ? squarify(state.videoList) : state.videoList)
	}, [state.videoList, props.grid])

	useEffect(() => {
		const count = state.videoList.length
		if (count > 0 && parseInt(activeTab) >= count) setActiveTab(String(count - 1))
	}, [state.videoList])

	if (props.list) {
		return (
			<div className="flex flex-col gap-3">
				<div className="flex justify-end">
					<Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={restart} disabled={state.restarting} title="Restart all camera streams">
						<RefreshCw className={cn("size-3.5", state.restarting && "animate-spin")} />
						{state.restarting ? "Restarting…" : "Restart streams"}
					</Button>
				</div>
				{state.videoList.map((video) => (
					<Feed key={video.url} video={video} />
				))}
			</div>
		)
	}

	if (props.grid) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex justify-end">
					<Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={restart} disabled={state.restarting} title="Restart all camera streams">
						<RefreshCw className={cn("size-3.5", state.restarting && "animate-spin")} />
						{state.restarting ? "Restarting…" : "Restart streams"}
					</Button>
				</div>
				{videos.map((row, ri) => (
					<div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
						{row.map((video) =>
							video ? (
								<Feed key={video.url} video={video} />
							) : null
						)}
					</div>
				))}
			</div>
		)
	}

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm">Live Video</CardTitle>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" className="size-6" onClick={refresh}>
						<RefreshCw className="size-3" />
					</Button>
					<NavigateToRoute to="/live" />
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{state.videoList.length > 0 && (
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="w-full rounded-none border-b border-border bg-surface-raised">
							{state.videoList.map((video, i) => (
								<TabsTrigger key={video.url} value={String(i)} className="flex-1 min-w-[3.5rem] shrink-0 text-sm h-10">
									{video.camera}
								</TabsTrigger>
							))}
						</TabsList>
						{state.videoList.map((video, i) => (
							<TabsContent key={video.url} value={String(i)} className="mt-0">
								<Feed video={video} hideLabel />
							</TabsContent>
						))}
					</Tabs>
				)}
			</CardContent>
		</Card>
	)
}

export default LiveVideo
