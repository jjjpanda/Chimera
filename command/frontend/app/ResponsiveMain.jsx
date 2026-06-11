import React, { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useMediaQuery } from "react-responsive"

import Main from "./Main.jsx"
import MobileMain from "./MobileMain.jsx"

import {routeToIndex} from "../js/routeIndexMapping"

const ResponsiveMain = () => {
	const {route} = useParams()

	let index = routeToIndex(route)

	const isTabletOrMobile = useMediaQuery({ query: "(max-width: 600px)" })
	const [layoutMobile, setLayoutMobile] = useState(isTabletOrMobile)

	useEffect(() => {
		if (!document.fullscreenElement) {
			setLayoutMobile(isTabletOrMobile)
		}
	}, [isTabletOrMobile])

	if(layoutMobile){
		return <MobileMain index={index}/>
	}
	else{
		return <Main index={index}/>
	}
}

export default ResponsiveMain