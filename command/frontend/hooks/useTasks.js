import React, { useState, useEffect } from "react"

import {request, jsonProcessing} from "../js/request.js"

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

const afterRequestCallbackGenerator = (setKey) => (prom) => {
	jsonProcessing(prom, (data) => {
		setTimeout(() => {
			setKey(k => k + 1)
		}, 1500)
	})
}

const taskActionGenerator = (url) => (setKey) => (id) => {
	request(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			id
		})
	}, afterRequestCallbackGenerator(setKey))
}

const restartTasksGenerator = taskActionGenerator("/task/start")
const stopTasksGenerator = taskActionGenerator("/task/stop")
const deleteTasksGenerator = taskActionGenerator("/task/destroy")

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
		restartTasksGenerator(setKey),
		stopTasksGenerator(setKey),
		deleteTasksGenerator(setKey),
		reload
	]
}

export default useTasks