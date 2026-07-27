import { useState, useEffect } from "react"

import {request, jsonProcessing} from "../js/request.js"
import toast from "../js/toast.js"

const listTasks = (setState) => {
	setState(() => ({
		processList: [],
		loading: true
	}))
	request("/task/list", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		}
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			setState(() => ({
				processList: data?.tasks ?? [],
				loading: false
			}))
		})
	})
}

const mutateTaskGenerator = (setKey, url, action, applied) => (id) => {
	request(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			id
		})
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if (!data?.[applied]) toast(`Couldn't ${action} task`)
			setTimeout(() => {
				setKey(k => k + 1)
			}, 1500)
		})
	})
}

const useTasks = () => {
	const [state, setState] = useState({
		processList: [],
		loading: false
	})

	const [key, setKey] = useState(1)

	useEffect(() => {
		listTasks(setState)
	}, [key])

	const reload = () => setKey(k => k + 1)

	return [
		state,
		mutateTaskGenerator(setKey, "/task/start", "restart", "running"),
		mutateTaskGenerator(setKey, "/task/stop", "stop", "stopped"),
		mutateTaskGenerator(setKey, "/task/destroy", "delete", "destroyed"),
		reload
	]
}

export default useTasks
