import React from "react"
import { useParams } from "react-router-dom"
import { useMediaQuery } from "react-responsive"

import Main from "./Main.jsx"
import MobileMain from "./MobileMain.jsx"

import {routeToIndex} from "../js/routeIndexMapping"

const ResponsiveMain = () => {
	const {route} = useParams()
	
	let index = routeToIndex(route)

	const isTabletOrMobile = useMediaQuery({ query: "(max-width: 600px)" }) 

	if(isTabletOrMobile){
		return <MobileMain index={index}/>
	}
	else{
		return <Main index={index}/>
	}
}

export default ResponsiveMain