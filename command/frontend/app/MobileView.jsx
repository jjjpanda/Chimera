import React from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "./AuthContext"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import SummaryScrubber from "./SummaryScrubber"
import StatusTree from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"

const MobileView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo list />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return <ScheduleDashboard mobile />

	if (index === "route-6") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<LiveVideo mobile />
			<SummaryScrubber numberOfFrames={10} mobile />
			<StatusTree />
			{role === "admin" && <StorageWidget />}
		</div>
	)
}

export default MobileView
