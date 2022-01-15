import React, {useState, useEffect} from "react"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { formatBytes } from "lib"
import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import cameraInfo from '../js/cameraInfo.js'
import colors from '../js/colors.js'

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
                    return payload[index].value == 0 ? null : `${name} : ${value}`
                })}
            </div>
        );
    }
  
    return null;
};

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

const FileStatsLineChart = (props) => {
    const [state, setState] = useState({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map(cameraInfo),
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: []
	})

	useEffect(() => {
		statsUpdate(state, setState)
	}, [])

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={state.fileStats}>
                <Tooltip content={customTooltip} />
                <XAxis 
                    dataKey="timestamp" 
                    domain={['auto', 'auto']} 
                    tickFormatter={unixTime => moment(unixTime).format('MM/DD')}
                    type="number"
                />
                <YAxis tickFormatter={bytes => formatBytes( bytes, 2 )}/>
                <Legend />
                {
                    state.cameras.map(({name}, index) => {
                        return <Line type="monotone" dataKey={name} stroke={colors[index % colors.length]} />
                    })
                }
            </LineChart>
        </ResponsiveContainer>
    )
}

export default FileStatsLineChart;