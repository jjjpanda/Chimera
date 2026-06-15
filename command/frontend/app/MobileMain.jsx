import React from "react"

import SideMenu from "./SideMenu"
import MobileView from "./MobileView"

const MobileMain = ({ index }) => (
	<div className="min-h-screen bg-bg pb-24 pt-4 px-3">
		<MobileView index={index} />
		<SideMenu mobile index={index} />
	</div>
)

export default MobileMain
