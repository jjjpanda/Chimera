import React from "react"

import { Layout } from "antd"
const { Content } = Layout
import SideMenu from "./SideMenu"
import DesktopView from "./DesktopView"

const Main = (props) => {
    return (
		<Layout style={{minHeight: "100vh"}}>
			<SideMenu index={props.index}/>
			<Content>
				<DesktopView index={props.index} />
			</Content>
		</Layout>
    )
}

export default Main