import React from "react"
import { useParams } from "react-router-dom"

import { Row, Col, Layout } from "antd"
const { Content } = Layout
import SideMenu from "./SideMenu"
import DesktopView from "./DesktopView"

import {routeToIndex} from "../js/routeIndexMapping";

const Main = () => {
	const {route} = useParams()

	let index = routeToIndex(route)

    return (
		<Layout style={{minHeight: "100vh"}}>
			<SideMenu index={index}/>
			<Content>
				<DesktopView index={index} />
			</Content>
		</Layout>
    )
}

export default Main