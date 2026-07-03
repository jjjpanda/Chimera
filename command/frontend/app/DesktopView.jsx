import React from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "./AuthContext"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import ProcessList from "./ProcessList"
import Status from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"
import ObjectDetections from "./ObjectDetections.jsx"

const DesktopView = ({ index }) => {
	const role = useRole()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo grid />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return role === "admin" ? <ScheduleDashboard /> : <Navigate to="/" />

	if (index === "route-7") return <ObjectDetections />

	if (index === "route-6") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 lg:[grid-template-columns:1fr_2fr_2fr]">
				<Status />
				<LiveVideo />
				<StorageWidget />
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ gridAutoRows: "20rem" }}>
				<ObjectDetections mini />
				<ClipMaker mini />
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ gridAutoRows: "16rem" }}>
				{role === "admin" && <ScheduleDashboard mini withButton />}
				<ProcessList mini />
				{role === "admin" && <AdminPanel withButton />}
			</div>
		</div>
	)
}

export default DesktopView
