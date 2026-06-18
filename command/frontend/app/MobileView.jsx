import React from "react"
import { Navigate } from "react-router-dom"
import { Sun, Moon } from "lucide-react"
import { useRole } from "./AuthContext"
import { useTheme } from "./ThemeContext.jsx"
import { Switch } from "../components/ui/switch"

import LiveVideo from "./LiveVideo"
import ClipMaker from "./ClipMaker"
import RecordingsList from "./RecordingsList"
import Stats from "./Stats.jsx"
import StorageWidget from "./StorageWidget.jsx"
import Status from "./StatusTree"
import AdminPanel from "./AdminPanel"
import ScheduleDashboard from "./ScheduleDashboard.jsx"
import ObjectDetections from "./ObjectDetections.jsx"
import SignOutButton from "./SignOutButton.jsx"
import ProcessList from "./ProcessList.jsx"

const MobileView = ({ index }) => {
	const role = useRole()
	const { dark, toggle } = useTheme()

	if (index === "route-1") return <ClipMaker />

	if (index === "route-2") return <LiveVideo list />

	if (index === "route-3") return <RecordingsList />

	if (index === "route-4") return <Stats />

	if (index === "route-5") return <ScheduleDashboard mobile />

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
			<Status withUsers={role === "admin"} />
			{role === "admin" && <StorageWidget />}
			<ScheduleDashboard mini withButton />
			<div className="flex items-center rounded-md border border-border text-muted">
				<div className="flex flex-1 items-center justify-center gap-2 py-2">
					<Moon className="size-4" />
					<Switch checked={!dark} onCheckedChange={toggle} />
					<Sun className="size-4" />
				</div>
				<div className="w-px self-stretch bg-border" />
				<SignOutButton className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors hover:bg-surface-raised hover:text-primary" iconOnly={false} />
			</div>
		</div>
	)
}

export default MobileView
