import React from "react"

import { Space } from "antd-mobile"
import SideMenu from "./SideMenu"
import MobileView from "./MobileView"

const MobileMain = (props) => {
	return (
		<Space direction='vertical' justify='center' style={{minWidth: "100%"}}>
			<SideMenu mobile index={props.index} />
			<MobileView index={props.index} />
		</Space>
	)
}

export default MobileMain