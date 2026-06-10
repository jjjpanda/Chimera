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
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"
import StatusTree from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"

const DesktopView = ({ index }) => {
	const role = useRole()
	const navigate = useNavigate()

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
				<Card className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px]">
					<Scissors className="h-8 w-8 opacity-30 text-muted" />
					<p className="text-sm text-muted text-center">Browse and export past footage</p>
					<Button variant="outline" size="sm" onClick={() => navigate("/clip")}>Open Clip Maker</Button>
				</Card>
			</div>
		</div>
	)
}

export default DesktopView
