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

const DesktopView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <LiveVideo grid />

	if (index === "route-2") return <SummaryScrubber />

	if (index === "route-3") return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div className="lg:col-span-1"><FileStatsPieChart /></div>
			<div className="lg:col-span-2"><FileStatsLineChart /></div>
		</div>
	)

	if (index === "route-4") return <ScheduleDashboard />

	if (index === "route-5") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<StatusTree />
				<FileStatsPieChart withButton />
				<LiveVideo />
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<TaskList withButton />
				<ProcessList withButton />
				<SummaryScrubber numberOfFrames={10} withButton />
			</div>
		</div>
	)
}

export default DesktopView
