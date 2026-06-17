import { useEffect, useState } from "react"
import useCamDateNumInfo from "./useCamDateNumInfo.js"
import useScheduler from "./useScheduler"
import useCameras from "./useCameras.js"
import moment from "moment"
import { request, jsonProcessing, downloadProcessing } from "../js/request.js"
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
					moment(b.requested, "YYYYMMDD-HHmmss").diff(moment(a.requested, "YYYYMMDD-HHmmss"), "seconds")
				)],
				lastUpdated: moment().format("h:mm:ss a"),
				loading: false
			}))
		})
	})
}

const processBody = (state, cameras, useDays = false) => {
	const id = cameras[state.camera]?.id
	return JSON.stringify({
		camera: String(id),
		...(useDays ? { days: state.days } : {}),
		start: moment(state.startDate).second(0).format("YYYYMMDD-HHmmss"),
		end: moment(state.endDate).second(0).format("YYYYMMDD-HHmmss"),
		skip: state.number,
		save: !state.download
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

const useProcesses = (settings = {}) => {
	const [cameras] = useCameras()
	const [scheduleTask] = useScheduler()
	const [state, setState] = useCamDateNumInfo({
		download: false,
		numberType: "speed",
		processList: []
	})

	const [dialog, setDialog] = useState({
		open: false,
		processType: null,
		days: false
	})

	const onChange = (patch) => setState((s) => ({ ...s, ...patch }))

	const createProcessFn = (type) => {
		if (cameras[state.camera]?.id == null) return toast("Cameras still loading")
		const url = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		const body = processBody(state, cameras, false)
		if (state.download) {
			const remove = toast("Generating", 0)
			request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body
			}, (prom) => {
				downloadProcessing(prom, () => remove())
			})
		} else {
			request(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body
			}, (prom) => {
				jsonProcessing(prom, () => {
					setDialog({ open: false, processType: null, days: false })
					setTimeout(() => listProcesses(setState), 1500)
				})
			})
		}
	}

	const scheduleProcessFn = (type, cronString) => {
		if (cameras[state.camera]?.id == null) return toast("Cameras still loading")
		const url = type === "video" ? "/convert/createVideo" : "/convert/createZip"
		const body = processBody(state, cameras, true)
		scheduleTask(url, body, cronString, () => {
			setDialog({ open: false, processType: null, days: false })
		})
	}

	useEffect(() => {
		listProcesses(setState)
	}, [])

	return [
		state,
		cancelProcessGenerator(setState),
		deleteProcessGenerator(setState),
		createProcessFn,
		scheduleProcessFn,
		dialog,
		setDialog,
		onChange
	]
}

export default useProcesses
