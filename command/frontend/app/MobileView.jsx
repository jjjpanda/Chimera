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
import ScheduleDashboard from "./ScheduleDashboard.jsx"

const MobileView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <LiveVideo list />

	if (index === "route-2") return <SummaryScrubber mobile />

	if (index === "route-3") return (
		<div className="space-y-4">
			<div className="flex h-[360px]"><FileStatsPieChart mobile /></div>
			<div className="flex h-[360px]"><FileStatsLineChart mobile /></div>
		</div>
	)

	if (index === "route-4") return <ScheduleDashboard mobile />

	if (index === "route-5") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<LiveVideo mobile />
			<SummaryScrubber numberOfFrames={10} withButton mobile />
			<StatusTree />
		</div>
	)
}

export default MobileView
