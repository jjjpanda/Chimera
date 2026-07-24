import { useState, useEffect } from "react"
import { request, jsonProcessing } from "../js/request.js"

const POLL_MS = 5000

const useTaskRuns = (taskId, active = false) => {
	const [state, setState] = useState({ runs: [], loading: false })
	const [key, setKey] = useState(1)

	const fetchRuns = (silent = false) => {
		if (!silent) setState(s => ({ ...s, loading: true }))
		const url = taskId ? `/task/runs/${taskId}` : "/task/runs"
		request(url, { method: "GET" }, (prom) => {
			jsonProcessing(prom, (data) => {
				setState({
					runs: data?.runs ?? [],
					loading: false
				})
			})
		})
	}

	useEffect(() => {
		fetchRuns()
	}, [key, taskId])

	useEffect(() => {
		if (!active) return
		const timer = setInterval(() => fetchRuns(true), POLL_MS)
		return () => clearInterval(timer)
	}, [active, taskId])

	return [state, () => setKey(k => k + 1)]
}

export default useTaskRuns
