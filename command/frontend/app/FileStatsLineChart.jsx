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
					return <div>{payload[index].value == 0 ? null : `${name} : ${value}`}<br/></div>
				})}
			</div>
		)
	}
  
	return null
}


const FileStatsLineChart = (props) => {
	const [state] = useFileStats({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map(cameraInfo),
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: []
	})

	return (
		<ResponsiveContainer>
			<LineChart data={props.mobile ? state.fileStats.slice(state.fileStats.length-3, state.fileStats.length) : state.fileStats}>
				<Tooltip content={customTooltip} />
				<XAxis 
					dataKey="timestamp" 
					domain={["auto", "auto"]} 
					tickFormatter={unixTime => moment(unixTime).format("MM/DD")}
					type="number"
				/>
				<YAxis tickFormatter={bytes => formatBytes( bytes, 2 )}/>
				<Legend layout="horizontal" align="right" verticalAlign="top" />
				{
					state.cameras.map(({name}, index) => {
						return <Line type="monotone" dataKey={name} stroke={colors[index % colors.length]} />
					})
				}
			</LineChart>
		</ResponsiveContainer>
	)
}

export default FileStatsLineChart