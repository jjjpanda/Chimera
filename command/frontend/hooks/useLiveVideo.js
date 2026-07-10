import { useEffect, useState, useRef } from "react"

import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"
import toast from "../js/toast.js"

const listVideos = (cameras, setState, seqRef) => {
	const seq = ++seqRef.current
	setState((old) => ({ ...old, loading: true }))
	request("/livestream/status", {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		mode: "cors"
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if (seq !== seqRef.current) return
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

const attemptRestart = (camera) =>
	request("/livestream/restart", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ camera }),
		mode: "cors"
	}, (prom) => prom)

const useLiveVideo = (cameras) => {
	const seqRef = useRef(0)
	const [state, setState] = useState({
		loading: false,
		restarting: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: []
	})

	const refresh = () => listVideos(cameras, setState, seqRef)

	const restartAll = () => {
		if (!cameras.length || state.restarting) return
		setState((old) => ({ ...old, restarting: true }))
		toast("Restarting livestreams…")
		Promise.allSettled(cameras.map((cam) => attemptRestart(cam.id))).then(() => {
			setState((old) => ({ ...old, restarting: false }))
			refresh()
		})
	}

	useEffect(() => {
		refresh()
	}, [cameras])

	return [state, refresh, restartAll]
}

export default useLiveVideo
