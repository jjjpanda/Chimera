import React from "react"

import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
class FileStats extends React.Component {
	constructor(props){
		super(props)
		this.state = {
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
		}
	}

	componentDidMount = () => {
		this.cameraUpdate()
		this.statsUpdate()
	}

	doneLoading = () => {
		this.setState(() => ({
			lastUpdated: moment().format("h:mm:ss a"),
			loading: undefined
		}))
	}

	statsUpdate = () => {
		request("/file/pathStats", {
			method: "GET"
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				if(data != undefined){
					this.setState(() => ({
						fileStats: data,
					}))
				}
			})
		})
	}

	cameraUpdate = () => {
		this.setState({
			loading: "refreshing",
			lastUpdated: moment().format("h:mm:ss a")
		}, () => {
			request("/file/pathMetrics", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			}, (prom) => {
				jsonProcessing(prom, (data) => {
					if("count" in data && "size" in data){
						this.setState((oldState) => {
							oldState.cameras.forEach((camera, index) => {
								oldState.cameras[index].size = parseInt(data.size[camera.name])
								oldState.cameras[index].count = parseInt(data.count[camera.name])
							})
							return oldState
						}, this.doneLoading)
					}
					else{
						this.doneLoading()
					}
				})
			})
		})
	}

	deleteFiles = (camera=undefined) => {
		if(camera != undefined){
			this.setState({
				loading: "deleting"
			}, () => {
				request("/file/pathClean", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						camera,
						days: this.state.days
					})
				}, (prom) => {
					jsonProcessing(prom, (data) => {
						console.log(data)
						this.cameraUpdate()
					})
				})
			})
		}
		else{
			this.setState({
				loading: "deleting"
			}, () => {
				Promise.all(this.state.cameras.map((camera) => {
					request("/file/pathClean", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							camera: camera.number,
							days: this.state.days
						})
					}, (prom) => {
						jsonProcessing(prom, (data) => {
							console.log(data)
							resolve()
						})
					}) 
				})).then(this.cameraUpdate)
			})
		}
	}

    handlePieClick = ({name, number, target}) => {
        console.log(name, number, target)
    }

    render() {
		const pieChart = <FileStatsPieChart 
			cameras={this.state.cameras}
			onClick={this.handlePieClick}
		/>
		const lineChart = <FileStatsLineChart 
			cameras={this.state.cameras}
			fileStats={this.state.fileStats}
		/>
		return lineChart
    }
}

export default FileStats