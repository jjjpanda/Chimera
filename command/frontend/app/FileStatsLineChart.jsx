import React from "react"
import useFileStats from "../hooks/useFileStats.js"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

import moment from "moment"
import { formatBytes } from "lib"

import cameraInfo from "../js/cameraInfo.js"
import colors from "../js/colors.js"

const customTooltip = ({ active, payload }) => {
	if (active && payload && payload.length) {
		const timestamp = payload[0].payload ? payload[0].payload.timestamp : null
		return (
			<div style={{backgroundColor: "#000", color: "#fff"}}>
				{`${timestamp ? moment(timestamp).format("MM/DD HH:00") : null}`}
				<br />
				{payload.map((cam, index) => {
					const name = payload[index].name
					const value = formatBytes( payload[index].value, 2 )
					return <div>{`${name} : ${payload[index].value == 0 ? "-" : value}`}<br/></div>
				})}
			</div>
		)
	}
  
	return null
}

const FileStatsLineChart = (props) => {
	const [state, setState] = useFileStats({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map(cameraInfo),
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: [],
		hide: JSON.parse(process.env.cameras).reduce((obj, cam) => ({...obj, [cam]: false}), {})
	})

	console.log("STATS", state)

	const legendHandler = ({ payload }) => {
		console.log("LEGEND", payload)
		const {dataKey} = payload
		if(dataKey != undefined){
			setState((oldState) => {
				let {hide} = oldState
				hide[dataKey] = !oldState.hide[dataKey]
				return {...oldState, hide, lastUpdated: moment().format("h:mm:ss a")}
			})
		}
	}

	return (
		<ResponsiveContainer key={`LINE-CHART-${state.lastUpdated}`}>
			<LineChart data={props.mobile ? state.fileStats.slice(state.fileStats.length-3, state.fileStats.length) : state.fileStats}>
				<Tooltip content={customTooltip} />
				<XAxis 
					dataKey="timestamp" 
					domain={["auto", "auto"]} 
					tickFormatter={unixTime => moment(unixTime).format("MM/DD")}
					type="number"
				/>
				<YAxis tickFormatter={bytes => formatBytes( bytes, 2 )}/>
				<Legend onClick={legendHandler} layout="horizontal" align="right" verticalAlign="top" />
				{
					state.cameras.map(({name}, index) => {
						return <Line hide={state.hide[name]} type="monotone" dataKey={name} dot={false} stroke={colors[index % colors.length]} />
					})
				}
			</LineChart>
		</ResponsiveContainer>
	)
}

export default FileStatsLineChart