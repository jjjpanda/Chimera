import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { Space } from 'antd-mobile';
import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"

const routeToIndex = (r) => {
	switch(r){
	case "":
		return 0
	case "live":
		return 1
	case "process":
		return 2
	case "scrub":
		return 3
	case "stats":
		return 4
	default: 
		return 0
	}
}

const MobileMain = () => {
	const [collapsed, setCollapsed] = useState(false)

	const {route} = useParams()
	const navigate = useNavigate()
	let index = routeToIndex(route)
    return (
		<Space direction='vertical' justify='center' style={{minWidth: "100%"}}>
      
            <SummaryScrubber />
            <LiveVideo />
            <ProcessList />
        </Space>
    )
}

export default MobileMain