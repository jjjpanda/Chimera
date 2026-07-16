import React from "react"

import SideMenu from "./SideMenu"
import DesktopView from "./DesktopView"

const Main = ({ index }) => (
	<div className="flex min-h-screen bg-bg">
		<SideMenu index={index} />
		<main className="min-w-0 flex-1 px-4 py-4">
			<DesktopView index={index} />
		</main>
	</div>
)

export default Main
