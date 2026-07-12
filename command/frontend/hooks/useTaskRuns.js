import { useState, useEffect, useRef } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useTaskRuns = (taskId) => {
	const [state, setState] = useState({ runs: [], loading: false })
	const [key, setKey] = useState(1)
	const seqRef = useRef(0)

	useEffect(() => {
		const seq = ++seqRef.current
		setState(s => ({ ...s, loading: true }))
		const url = taskId ? `/task/runs/${taskId}` : "/task/runs"
		request(url, { method: "GET" }, (prom) => {
			jsonProcessing(prom, (data) => {
				if (seq !== seqRef.current) return
				setState({
					runs: data?.runs ?? [],
					loading: false
				})
			})
		})
	}, [key, taskId])

	return [state, () => setKey(k => k + 1)]
}

export default useTaskRuns
