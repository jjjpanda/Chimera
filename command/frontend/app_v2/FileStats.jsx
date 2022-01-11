import React, {useState, useEffect} from "react"

import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"

const doneLoading = (state, setState) => {
	setState(() => ({
		...state,
		lastUpdated: moment().format("h:mm:ss a"),
		loading: undefined
	}))
}

const statsUpdate = (state, setState) => {
	request("/file/pathStats", {
		method: "GET"
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data != undefined){
				setState({
					...state,
					fileStats: data,
				})
			}
		})
	})
}

const cameraUpdate = (state, setState) => {
	setState({
		...state,
		loading: "refreshing",
		lastUpdated: moment().format("h:mm:ss a")
	})
	request("/file/pathMetrics", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data && "count" in data && "size" in data){
				setState(state.cameras.map((camera) => ({
					...cam,
					size: parseInt(data.size[camera.name]),
					count: parseInt(data.count[camera.name])
				})))
			}
			doneLoading(state, setState)
		})
	})
}

const deleteFiles = (state, setState, camera=undefined) => {
	setState({
		loading: "deleting"
	})
	if(camera != undefined){
		request("/file/pathClean", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				camera,
				days: state.days
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				cameraUpdate(state, setState)
			})
		})
	}
	else{
		Promise.all(state.cameras.map((camera) => {
			request("/file/pathClean", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					camera: camera.number,
					days: state.days
				})
			}, (prom) => {
				jsonProcessing(prom, (data) => {
					resolve()
				})
			}) 
		})).then(() => cameraUpdate(state, setState))
	}
}

const handlePieClick = ({name, number, target}) => {
	console.log(name, number, target)
}

const FileStats = (props) => {
	const [state, setState] = useState({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map((element, index) => {
			return {
				path: `shared/captures/${index + 1}`,
				number: index+1,
				name: element,
				size: 0,
				count: 0
			}
		}),
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: []
	})

	useEffect(() => {
		cameraUpdate(state, setState)
		statsUpdate(state, setState)
	}, [])

	const pieChart = <FileStatsPieChart 
		cameras={state.cameras}
		onClick={handlePieClick}
	/>
	const lineChart = <FileStatsLineChart 
		cameras={state.cameras}
		fileStats={state.fileStats}
	/>
	return lineChart
}

export default FileStats