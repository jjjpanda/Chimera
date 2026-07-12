import { useEffect, useRef, useState } from "react"
import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"
import toast from "../js/toast.js"

const POLL_MS = 5000

const listProcesses = (setState, seqRef, silent = false) => {
	const seq = ++seqRef.current
	if (!silent) setState((s) => ({ ...s, processList: [], loading: true }))
	request("/convert/listProcess", {
		method: "GET",
		headers: { "Content-Type": "application/json" }
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if (seq !== seqRef.current) return
			setState((s) => ({
				...s,
				processList: [...(data?.list ?? []).sort((a, b) =>
					moment.utc(b.requested, "YYYYMMDD-HHmmss").diff(moment.utc(a.requested, "YYYYMMDD-HHmmss"), "seconds")
				)],
				lastUpdated: moment().format("h:mm:ss a"),
				loading: false
			}))
		})
	})
}

const cancelProcessGenerator = (setState, seqRef) => (id) => {
	request("/convert/cancelProcess", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id })
	}, (prom) => {
		jsonProcessing(prom, () => {
			setTimeout(() => listProcesses(setState, seqRef, true), 1500)
		})
	})
}

const deleteProcessGenerator = (setState, seqRef) => (id) => {
	const remove = toast("Attempting Delete…", 0)
	request("/convert/deleteProcess", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id })
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			remove()
			toast(data?.deleted ? "Files Deleted" : "None Deleted")
			setTimeout(() => listProcesses(setState, seqRef, true), 1500)
		})
	})
}

const useProcesses = () => {
	const [state, setState] = useState({ processList: [], loading: true })
	const seqRef = useRef(0)

	useEffect(() => {
		listProcesses(setState, seqRef)
		const timer = setInterval(() => {
			if (!document.hidden) listProcesses(setState, seqRef, true)
		}, POLL_MS)
		return () => clearInterval(timer)
	}, [])

	return [
		state,
		cancelProcessGenerator(setState, seqRef),
		deleteProcessGenerator(setState, seqRef)
	]
}

export default useProcesses
