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
import { RefreshCw, Maximize2 } from "lucide-react"
import { cn } from "../lib/utils"

const HlsPlayer = ({ src, className }) => (
	<ReactHlsPlayer
		src={src}
		autoPlay={false}
		controls={true}
		playsInline
		className={className}
	/>
)

const Feed = ({ video, onExpand, hideLabel }) => (
	<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
		<HlsPlayer src={video.url} className="absolute inset-0 h-full w-full object-contain" />
		{!hideLabel && (
			<div className="pointer-events-none absolute left-3 top-2 flex items-center gap-2">
				<span className={cn("size-2 rounded-full shrink-0", video.online ? "bg-emerald-500" : "bg-danger")} />
				<span className="text-sm font-medium text-primary drop-shadow">{video.camera}</span>
			</div>
		)}
		{onExpand && (
			<Button
				variant="ghost"
				size="icon"
				className="absolute right-2 top-2 size-7 bg-black/40 text-white hover:bg-black/60"
				onClick={onExpand}
			>
				<Maximize2 className="size-3.5" />
			</Button>
		)}
	</div>
)

const LiveVideo = (props) => {
	const [cameras, camsLoading] = useCameras()
	const [state, refresh, restart] = useLiveVideo(cameras)
	const [videos, setVideos] = useState([])
	const [activeDialog, setActiveDialog] = useState(null)
	const squarify = useSquarifyVideos()

	useEffect(() => {
		setVideos(props.grid ? squarify(state.videoList) : state.videoList)
	}, [state.videoList, props.grid])

	const expandDialog = (
		<Dialog open={!!activeDialog} onOpenChange={() => setActiveDialog(null)}>
			<DialogContent className="max-w-3xl bg-surface border-border p-0 overflow-hidden">
				{activeDialog && (
					<div>
						<HlsPlayer src={activeDialog.url} className="w-full" />
						<div className="flex items-center gap-2 px-4 py-2">
							<span className={cn("size-2 rounded-full shrink-0", activeDialog.online ? "bg-emerald-500" : "bg-danger")} />
							<span className="text-sm text-primary">{activeDialog.camera}</span>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)

	if (props.list) {
		return (
			<div className="flex flex-col gap-3">
				<div className="flex justify-end">
					<Button variant="ghost" size="icon" className="size-7" onClick={refresh}>
						<RefreshCw className="size-3.5" />
					</Button>
				</div>
				{state.videoList.map((video, i) => (
					<Feed key={i} video={video} />
				))}
			</div>
		)
	}

	if (props.grid) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex justify-end">
					<Button variant="ghost" size="icon" className="size-7" onClick={refresh}>
						<RefreshCw className="size-3.5" />
					</Button>
				</div>
				{videos.map((row, ri) => (
					<div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
						{row.map((video, ci) =>
							video ? (
								<Feed key={ci} video={video} onExpand={() => setActiveDialog(video)} />
							) : null
						)}
					</div>
				))}
				{expandDialog}
			</div>
		)
	}

	const tabDefault = state.videoList.length > 0 ? "0" : undefined

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
					<Tabs defaultValue={tabDefault}>
						<TabsList className="w-full rounded-none border-b border-border bg-surface-raised">
							{state.videoList.map((video, i) => (
								<TabsTrigger key={i} value={String(i)} className="flex-1 text-xs">
									{video.camera}
								</TabsTrigger>
							))}
						</TabsList>
						{state.videoList.map((video, i) => (
							<TabsContent key={i} value={String(i)} className="mt-0">
								<Feed video={video} onExpand={() => setActiveDialog(video)} hideLabel />
							</TabsContent>
						))}
					</Tabs>
				)}
			</CardContent>
			{expandDialog}
		</Card>
	)
}

export default LiveVideo
