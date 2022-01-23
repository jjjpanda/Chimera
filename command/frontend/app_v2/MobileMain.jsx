import React from "react"
import { useParams } from "react-router-dom"

import { Space } from 'antd-mobile';
import SideMenu from './SideMenu'
import MobileView from "./MobileView";

import {routeToIndex} from "../js/routeIndexMapping";

const MobileMain = () => {
	const {route} = useParams()
	
	let index = routeToIndex(route)
    return (
		<Space direction='vertical' justify='center' style={{minWidth: "100%"}}>
			<SideMenu mobile index={index} />
			<MobileView index={index} />
        </Space>
    )
}

export default MobileMain