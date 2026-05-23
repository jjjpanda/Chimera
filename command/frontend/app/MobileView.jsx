import React from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "./AuthContext"

import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"
import StatusTree from "./StatusTree"
import AdminPanel from "./AdminPanel"

const MobileView = (props) => {
	const {index} = props
	const role = useRole()

	if(index == "route-1"){
		return <LiveVideo list/>
	}
	else if(index == "route-2"){
		return [<ProcessList showFooter mobile />, <TaskList />]
	}
	else if(index == "route-3"){
		return <SummaryScrubber mobile />
	}
	else if(index == "route-4"){
		return [
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsPieChart mobile />
			</div>,
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsLineChart mobile />
			</div>
		]
	}
	else if(index == "route-5"){
		return role === "admin" ? <AdminPanel /> : <Navigate to="/" />
	}
	return [
		<LiveVideo mobile />,
		<SummaryScrubber numberOfFrames={10} withButton mobile/>,
		<StatusTree />
	]
}

export default MobileView