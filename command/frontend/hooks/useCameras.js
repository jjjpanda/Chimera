import { useEffect, useState } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useCameras = () => {
	const [cameras, setCameras] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		request("/cameras", {
			method: "GET",
			headers: { "Content-Type": "application/json" }
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				setCameras(Array.isArray(data) ? data : [])
				setLoading(false)
			})
		})
	}, [])

	return [cameras, loading]
}

export default useCameras
