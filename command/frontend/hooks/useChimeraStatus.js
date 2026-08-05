import { useState, useEffect } from "react"
import { request, statusProcessing, jsonProcessing } from "../js/request.js"
import useCameras from "./useCameras.js"

const streamUp = (data) => Array.isArray(data) && data.length > 0 && data.every((p) => p.status === "online")

const baseStatusUrls = [
	{ statusType: "command", url: "/command/health" },
	{ statusType: "schedule", url: "/schedule/health" },
	{ statusType: "storage", url: "/storage/health" },
	{ statusType: "motion", url: "/motion/status" },
	{ statusType: "database", url: "/database/status" },
	{ statusType: "livestream", url: "/livestream/health" },
	{ statusType: "object", url: "/object/health" },
	{ statusType: "memory", url: "/memory/status" }
]

const useChimeraStatus = () => {
	const [cameras] = useCameras()
	const [status, setStatus] = useState({})

	const getOptions = {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		mode: "cors"
	}

	useEffect(() => {
		const cameraStatusUrls = cameras.map((cam) => ({
			statusType: `cam ${cam.name}`,
			url: `/livestream/status?camera=${cam.id}`,
			stream: true
		}))
		const allUrls = [...baseStatusUrls, ...cameraStatusUrls]

		setStatus((prev) => allUrls.reduce(
			(obj, { statusType }) => ({ ...obj, [statusType]: prev[statusType] || "loading" }),
			{}
		))

		let pollSeq = 0
		const applied = {}
		const poll = () => {
			if (document.hidden) return
			const seq = ++pollSeq
			for (const { statusType, url, stream } of allUrls) {
				request(url, getOptions, (prom) => {
					const apply = (up) => {
						if (seq <= (applied[statusType] || 0)) return
						applied[statusType] = seq
						setStatus((prev) => ({ ...prev, [statusType]: up ? "up" : "down" }))
					}
					if (stream) jsonProcessing(prom, (data) => apply(streamUp(data)))
					else statusProcessing(prom, 200, apply)
				})
			}
		}
		poll()
		const id = setInterval(poll, 5000)
		return () => clearInterval(id)
	}, [cameras])

	return [status]
}

export default useChimeraStatus
