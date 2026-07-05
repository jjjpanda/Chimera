import { useEffect, useState } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useStorageUsage = () => {
	const [data, setData] = useState({ used_gb: 0, max_gb: 0, cameras: [], total_frames: 0, breakdown: null, loading: true })

	const refresh = () => {
		setData(d => ({ ...d, loading: true }))
		request("/usage", { method: "GET" }, prom =>
			jsonProcessing(prom, (res) => {
				if (res && !res.error && Array.isArray(res.cameras)) {
					setData({ ...res, loading: false })
				} else {
					setData(d => ({ ...d, loading: false }))
				}
			})
		)
	}

	useEffect(() => { refresh() }, [])

	return [data, refresh]
}

export default useStorageUsage
