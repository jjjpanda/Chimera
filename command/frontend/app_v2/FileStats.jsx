import React from "react"

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Label } from "recharts"
import { formatBytes } from "lib"

import {request, jsonProcessing} from "./../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"

const COLORS = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6', 
'#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
'#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
'#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
'#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
'#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
'#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680', 
'#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
'#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3', 
'#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF']

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
			countStats: [],
			sizeStats: []
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
				if(data != undefined && "count" in data && "size" in data){
					this.setState(() => ({
						countStats: parseInt(data.count),
						sizeStats: parseInt(data.size)
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

    customTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const name = payload[0].name == "Free Space" ? payload[0].name : `Camera ${payload[0].name}`
            const value = payload[0].dataKey == "size" ? formatBytes( payload[0].value, 2 ) : `${payload[0].value} image${payload[0].value > 1 ? "s" : ""}`
            return (
                <div style={{backgroundColor: "#000", color: "#fff"}}>
                    {`${name} : ${value}`}
                </div>
            );
        }
      
        return null;
    };

    handlePieClick = ({name, number, target}) => {
        console.log(name, number, target)
    }

    render() {
        const sumSize = this.state.cameras.reduce((total, cam) => total+cam.size, 0)
        /* const bytesInTerabytes = 1099511627776
        const nearestTerabyte = Math.ceil(sumSize / bytesInTerabytes)
        const sizes = [
            ...this.state.cameras,
            {
                number: "Free Space",
                size: nearestTerabyte*bytesInTerabytes - sumSize
            }
        ]
        console.log(sizes, this.state.cameras) */
		return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip content={this.customTooltip} />
                    <Pie 
                        data={this.state.cameras} dataKey="count" nameKey="number" 
                        cx="50%" cy="50%" innerRadius={37} outerRadius={55}
                        onClick={this.handlePieClick}
                    >
                        {
                            this.state.cameras.map((entry, index) => <Cell fill={COLORS[index % COLORS.length]}/>)
                        }
                    </Pie>
                    <Pie 
                        data={this.state.cameras} dataKey="size" nameKey="number" 
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                        onClick={this.handlePieClick}
                    >
                        {
                            this.state.cameras.map((entry, index) => <Cell fill={COLORS[index % COLORS.length]}/>)
                        }
                        <Label 
                            value={`${formatBytes(sumSize, 1)}`} 
                            position="center" 
                            style={{fill: Cookies.get("theme") == "dark" ? "white" : "black"}} 
                            onClick={this.handlePieClick}
                        />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        )
    }
}

export default FileStats