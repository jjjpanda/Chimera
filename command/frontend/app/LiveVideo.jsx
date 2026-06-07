import React, { useState, useEffect } from "react"
import ReactHlsPlayer from "react-hls-player"
import useLiveVideo from "../hooks/useLiveVideo.js"
import useCameras from "../hooks/useCameras.js"
import useSquarifyVideos from "../hooks/useSquarifyVideo.js"
import NavigateToRoute from "./NavigateToRoute.jsx"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { Dialog, DialogContent } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { RefreshCw } from "lucide-react"
import { cn } from "../lib/utils"

const CameraCard = ({ video, onClick }) => (
	<div
		className="relative w-full overflow-hidden rounded-lg cursor-pointer bg-black aspect-video"
		onClick={onClick}
	>
		<img
			src={`/livestream/feed/thumbnail`}
			alt={video.camera}
			className="object-cover w-full h-full opacity-60"
			onError={(e) => { e.target.style.display = "none" }}
		/>
		<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
		<div className="absolute bottom-2 left-3 flex items-center gap-2">
			<span className={cn("size-2 rounded-full shrink-0", video.online ? "bg-emerald-500" : "bg-danger")} />
			<span className="text-sm font-medium text-primary drop-shadow">{video.camera}</span>
		</div>
	</div>
)

const HlsPlayer = ({ src }) => (
	<ReactHlsPlayer
		src={src}
		autoPlay={false}
		controls={true}
		width="100%"
		height="auto"
	/>
)

const LiveVideo = (props) => {
	const [cameras, camsLoading] = useCameras()
	const [state, , restart] = useLiveVideo(cameras)
	const [videos, setVideos] = useState([])
	const [activeDialog, setActiveDialog] = useState(null)
	const squarify = useSquarifyVideos()

	useEffect(() => {
		setVideos(props.grid ? squarify(state.videoList) : state.videoList)
	}, [state.videoList, props.grid])

	if (props.list) {
		return (
			<div className="flex flex-col gap-3">
				{state.videoList.map((video, i) => (
					<div key={i} className="relative">
						<HlsPlayer src={video.url} />
						<div className="flex items-center gap-2 mt-1 px-1">
							<span className={cn("size-2 rounded-full shrink-0", video.online ? "bg-emerald-500" : "bg-danger")} />
							<span className="text-sm text-muted">{video.camera}</span>
						</div>
					</div>
				))}
			</div>
		)
	}

	if (props.grid) {
		return (
			<div className="flex flex-col gap-2">
				{videos.map((row, ri) => (
					<div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
						{row.map((video, ci) =>
							video ? (
								<div key={ci}>
									<CameraCard video={video} onClick={() => setActiveDialog(video)} />
								</div>
							) : null
						)}
					</div>
				))}
				<Dialog open={!!activeDialog} onOpenChange={() => setActiveDialog(null)}>
					<DialogContent className="max-w-3xl bg-surface border-border p-0 overflow-hidden">
						{activeDialog && (
							<div>
								<HlsPlayer src={activeDialog.url} />
								<div className="flex items-center gap-2 px-4 py-2">
									<span className={cn("size-2 rounded-full shrink-0", activeDialog.online ? "bg-emerald-500" : "bg-danger")} />
									<span className="text-sm text-primary">{activeDialog.camera}</span>
								</div>
							</div>
						)}
					</DialogContent>
				</Dialog>
			</div>
		)
	}

	const tabDefault = state.videoList.length > 0 ? "0" : undefined

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm">Live Video</CardTitle>
				<NavigateToRoute to="/live" />
			</CardHeader>
			<CardContent className="p-0">
				{state.videoList.length > 0 && (
					<Tabs defaultValue={tabDefault}>
						<TabsList className="w-full rounded-none border-b border-border bg-surface-raised">
							{state.videoList.map((video, i) => (
								<TabsTrigger key={i} value={String(i)} className="flex-1 text-xs">
									{i + 1}
								</TabsTrigger>
							))}
						</TabsList>
						{state.videoList.map((video, i) => (
							<TabsContent key={i} value={String(i)} className="mt-0">
								<CameraCard video={video} onClick={() => setActiveDialog(video)} />
								<div className="flex items-center justify-between px-3 py-2">
									<span className="text-xs text-muted">{video.camera}</span>
									<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="icon"
											className="size-6"
											onClick={() => restart(i + 1)}
										>
											<RefreshCw className="size-3" />
										</Button>
										{!props.mobile && (
											<a href="/object" className="text-xs text-accent hover:underline">
												object view
											</a>
										)}
									</div>
								</div>
							</TabsContent>
						))}
					</Tabs>
				)}
			</CardContent>
			<Dialog open={!!activeDialog} onOpenChange={() => setActiveDialog(null)}>
				<DialogContent className="max-w-3xl bg-surface border-border p-0 overflow-hidden">
					{activeDialog && (
						<div>
							<HlsPlayer src={activeDialog.url} />
							<div className="flex items-center gap-2 px-4 py-2">
								<span className={cn("size-2 rounded-full shrink-0", activeDialog.online ? "bg-emerald-500" : "bg-danger")} />
								<span className="text-sm text-primary">{activeDialog.camera}</span>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	)
}

export default LiveVideo
