import React from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "./AuthContext"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"
import StatusTree from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"

const DesktopView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo grid />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return <ScheduleDashboard />

	if (index === "route-6") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<StatusTree />
				{role === "admin" && <StorageWidget />}
				<LiveVideo />
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<TaskList withButton />
				<ProcessList withButton />
				<SummaryScrubber numberOfFrames={10} />
			</div>
		</div>
	)
}

export default DesktopView
