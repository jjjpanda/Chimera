import { useCallback, useEffect, useState } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useObjectDetections = () => {
	const [status, setStatus] = useState(null)
	const [detections, setDetections] = useState([])

	const loadStatus = useCallback(() => {
		request("/object/status", {}, (prom) => jsonProcessing(prom, (data) => data && data.cameras && setStatus(data)))
	}, [])

	const loadDetections = useCallback(() => {
		request("/object/detections?limit=100", {}, (prom) => jsonProcessing(prom, (data) => Array.isArray(data) && setDetections(data)))
	}, [])

	const scan = useCallback((camera, onDone) => {
		request("/object/scan", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ camera })
		}, (prom) => jsonProcessing(prom, (data) => onDone && onDone(data)))
	}, [])

	useEffect(() => {
		loadStatus()
		loadDetections()
		const id = setInterval(loadStatus, 5000)
		return () => clearInterval(id)
	}, [loadStatus, loadDetections])

	return { status, detections, loadStatus, loadDetections, scan }
}

export default useObjectDetections
