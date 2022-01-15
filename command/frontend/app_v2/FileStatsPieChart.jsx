import React, {useState, useEffect} from "react"

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Label } from "recharts"
import { formatBytes } from "lib"
import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"
import cameraInfo from '../js/cameraInfo.js'
import colors from '../js/colors.js'

const customTooltip = ({ active, payload }) => {
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

const cameraUpdate = (state, setState) => {
	setState((oldState) => ({
		...oldState,
		loading: "refreshing",
		lastUpdated: moment().format("h:mm:ss a")
	}))
	request("/file/pathMetrics", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data && "count" in data && "size" in data){
				setState((oldState) => ({
					...oldState,
					cameras: oldState.cameras.map((camera) => ({
						...camera,
						size: parseInt(data.size[camera.name]),
						count: parseInt(data.count[camera.name])
					})),
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			}
			else{
				setState((oldState) => ({
					...oldState,
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			}
		})
	})
}

const deleteFiles = (state, setState, camera=undefined) => {
	setState((oldState) => ({
		...oldState,
		loading: "deleting"
	}))
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

const FileStatsPieChart = (props) => {
    const [state, setState] = useState({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map(cameraInfo),
		days: 7
	})

    useEffect(() => {
		cameraUpdate(state, setState)
	}, [])

    const sumSize = state.cameras.reduce((total, cam) => total+cam.size, 0)
    /* const bytesInTerabytes = 1099511627776
    const nearestTerabyte = Math.ceil(sumSize / bytesInTerabytes)
    const sizes = [
        ...state.cameras,
        {
            number: "Free Space",
            size: nearestTerabyte*bytesInTerabytes - sumSize
        }
    ]
    console.log(sizes, state.cameras) */
	console.log(state)
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip content={customTooltip} />
                <Pie 
                    data={state.cameras} dataKey="count" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={37} outerRadius={55}
                    onClick={handlePieClick}
                >
                    {
                        state.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                </Pie>
                <Pie 
                    data={state.cameras} dataKey="size" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                    onClick={handlePieClick}
                >
                    {
                        state.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                    <Label 
                        value={`${formatBytes(sumSize, 1)}`} 
                        position="center" 
                        style={{fill: Cookies.get("theme") == "dark" ? "white" : "black"}} 
                        onClick={handlePieClick}
                    />
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    )
}

export default FileStatsPieChart