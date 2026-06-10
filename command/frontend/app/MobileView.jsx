import React from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Scissors } from "lucide-react"
import { useRole } from "./AuthContext"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import StatusTree from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"

const MobileView = ({ index }) => {
	const role = useRole()
	const navigate = useNavigate()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo list />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return <ScheduleDashboard mobile />

	if (index === "route-6") return role === "admin" ? <AdminPanel /> : <Navigate to="/" />

	return (
		<div className="space-y-4">
			<LiveVideo mobile />
			<Card className="flex flex-col items-center justify-center gap-4 p-8">
				<Scissors className="h-8 w-8 opacity-30 text-muted" />
				<p className="text-sm text-muted text-center">Browse and export past footage</p>
				<Button variant="outline" size="sm" onClick={() => navigate("/clip")}>Open Clip Maker</Button>
			</Card>
			<StatusTree />
			{role === "admin" && <StorageWidget />}
		</div>
	)
}

export default MobileView
