import { useState, useEffect } from "react"
import { request, statusProcessing } from "../js/request.js"
import useCameras from "./useCameras.js"

const baseStatusUrls = [
	{ statusType: "command", url: "/command/health" },
	{ statusType: "schedule", url: "/schedule/health" },
	{ statusType: "storage", url: "/storage/health" },
	{ statusType: "motion", url: "/motion/status" },
	{ statusType: "database", url: "/database/status" },
	{ statusType: "livestream", url: "/livestream/health" },
	{ statusType: "memory", url: "/memory/status" },
	{ statusType: "object", url: "/object/status" }
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
			url: `/livestream/status?camera=${cam.id}`
		}))
		const allUrls = [...baseStatusUrls, ...cameraStatusUrls]

		setStatus((prev) => allUrls.reduce(
			(obj, { statusType }) => ({ ...obj, [statusType]: prev[statusType] || "loading" }),
			{}
		))

		for (const { statusType, url } of allUrls) {
			request(url, getOptions, (prom) => {
				statusProcessing(prom, 200, (successful) => {
					setStatus((prev) => ({ ...prev, [statusType]: successful ? "up" : "down" }))
				})
			})
		}
	}, [cameras])

	return [status]
}

export default useChimeraStatus
