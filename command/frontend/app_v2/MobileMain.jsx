import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { Space } from 'antd-mobile';
import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"
import ThemeSwitcher from "./ThemeSwitcher";

import routeToIndex from "../js/routeToIndex";

const MobileMain = () => {
	const [collapsed, setCollapsed] = useState(false)

	const {route} = useParams()
	const navigate = useNavigate()
	let index = routeToIndex(route)
    return (
		<Space direction='vertical' justify='center' style={{minWidth: "100%"}}>
			<ThemeSwitcher />
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsLineChart />
			</div>
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsPieChart />
			</div>
            <SummaryScrubber />
            <LiveVideo />
            <ProcessList />
        </Space>
    )
}

export default MobileMain