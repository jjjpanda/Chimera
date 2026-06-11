import React from "react"

import SideMenu from "./SideMenu"
import MobileView from "./MobileView"

const MobileMain = ({ index }) => (
	<div className="min-h-screen bg-bg pb-20 pt-4 px-1">
		<MobileView index={index} />
		<SideMenu mobile index={index} />
	</div>
)

export default MobileMain
