import { useState, useEffect } from "react"

import {request, jsonProcessing} from "../js/request.js"
import toast from "../js/toast.js"

const POLL_MS = 5000

const listTasks = (setState, silent = false) => {
	if (!silent) {
		setState(() => ({
			processList: [],
			loading: true
		}))
	}
	request("/task/list", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		}
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data && "tasks" in data){
				const {tasks} = data
				setState(() => ({
					processList: tasks,
					loading: false
				}))
			}
			else{
				setState(() => ({
					processList: [],
					loading: false
				}))
			}
		})
	})
}

const mutateTaskGenerator = (setKey, url, action) => (id) => {
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
			if (!data || data.error) toast(`Couldn't ${action} task`)
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

	const anyRunning = state.processList.some(t => t.running)
	useEffect(() => {
		if (!anyRunning) return
		const timer = setInterval(() => listTasks(setState, true), POLL_MS)
		return () => clearInterval(timer)
	}, [anyRunning])

	const reload = () => setKey(k => k + 1)

	return [
		state,
		mutateTaskGenerator(setKey, "/task/start", "restart"),
		mutateTaskGenerator(setKey, "/task/stop", "stop"),
		mutateTaskGenerator(setKey, "/task/destroy", "delete"),
		reload
	]
}

export default useTasks
