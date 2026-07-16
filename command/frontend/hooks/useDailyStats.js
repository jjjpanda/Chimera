import { useEffect, useState } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useDailyStats = () => {
	const [data, setData] = useState([])

	const refresh = () => {
		request("/file/dailyStats", { method: "GET" }, prom =>
			jsonProcessing(prom, (res) => {
				if (Array.isArray(res)) setData(res)
			})
		)
	}

	useEffect(() => { refresh() }, [])

	return [data, refresh]
}

export default useDailyStats
