import { useEffect, useState } from "react"

import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"

const listVideos = (cameras, setState) => {
	setState((old) => ({ ...old, loading: true, videoList: [] }))
	request("/livestream/status", {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		mode: "cors"
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			const nums = (Array.isArray(data) ? data : [])
				.map((cam) => parseInt(cam.name.split("_")[3]))
				.sort((a, b) => a - b)
			setState((old) => ({
				...old,
				loading: false,
				lastUpdated: moment().format("h:mm:ss a"),
				videoList: nums.map((num, idx) => {
					const cam = cameras.find((c) => c.id === num)
					return {
						camera: cam ? cam.name : `Camera ${num}`,
						online: true,
						url: `/livestream/feed/${num}/video.m3u8`
					}
				})
			}))
		})
	})
}

const attemptRestart = (camera) => {
	request("/livestream/restart", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ camera }),
		mode: "cors"
	})
}

const useLiveVideo = (cameras) => {
	const [state, setState] = useState({
		loading: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: []
	})

	const refresh = () => listVideos(cameras, setState)

	useEffect(() => {
		refresh()
	}, [cameras])

	return [state, refresh, attemptRestart]
}

export default useLiveVideo
