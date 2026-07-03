import React from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "./AuthContext"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import Status from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"
import ObjectDetections from "./ObjectDetections.jsx"
import ProcessList from "./ProcessList.jsx"

const MobileView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo list />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return role === "admin" ? <ScheduleDashboard mobile /> : <Navigate to="/" />

	if (index === "route-7") return <ObjectDetections mobile />

	if (index === "route-6") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<LiveVideo mobile />
			<div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2" style={{ gridAutoRows: "15rem" }}>
				<ClipMaker mini />
				<ObjectDetections mini />
			</div>
			<ProcessList mini />
			<Status />
			{role === "admin" && <AdminPanel withButton />}
			{role === "admin" && <StorageWidget />}
			{role === "admin" && <ScheduleDashboard mini withButton />}
		</div>
	)
}

export default MobileView
