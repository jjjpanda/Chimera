import { useState, useEffect } from "react"

import {request, jsonProcessing} from "../js/request.js"
import toast from "../js/toast.js"
import i18n from "../js/i18n.js"

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

const mutateTaskGenerator = (setKey, url, actionKey, applied) => (id) => {
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
			if (!data?.[applied]) toast(i18n.t("schedule.taskActionFailed", { action: i18n.t(actionKey) }))
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
		mutateTaskGenerator(setKey, "/task/start", "schedule.actionRestart", "running"),
		mutateTaskGenerator(setKey, "/task/stop", "schedule.actionStop", "stopped"),
		mutateTaskGenerator(setKey, "/task/destroy", "schedule.actionDelete", "destroyed"),
		reload
	]
}

export default useTasks
