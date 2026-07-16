import { useEffect, useState } from "react"
import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"
import toast from "../js/toast.js"

const listProcesses = (setState) => {
	setState((s) => ({ ...s, processList: [], loading: true }))
	request("/convert/listProcess", {
		method: "GET",
		headers: { "Content-Type": "application/json" }
	}, (prom) => {
		jsonProcessing(prom, (data) => {
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

const cancelProcessGenerator = (setState) => (id) => {
	request("/convert/cancelProcess", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id })
	}, (prom) => {
		jsonProcessing(prom, () => {
			setTimeout(() => listProcesses(setState), 1500)
		})
	})
}

const deleteProcessGenerator = (setState) => (id) => {
	const remove = toast("Attempting Delete…", 0)
	request("/convert/deleteProcess", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id })
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			remove()
			toast(data?.deleted ? "Files Deleted" : "None Deleted")
			setTimeout(() => listProcesses(setState), 1500)
		})
	})
}

const useProcesses = () => {
	const [state, setState] = useState({ processList: [], loading: true })

	useEffect(() => {
		listProcesses(setState)
	}, [])

	return [
		state,
		cancelProcessGenerator(setState),
		deleteProcessGenerator(setState)
	]
}

export default useProcesses
