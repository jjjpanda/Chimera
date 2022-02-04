import React from "react"
import { useNavigate } from "react-router-dom"

import {FullscreenOutlined} from "@ant-design/icons"

const NavigateToRoute = ({to}) => {
	const navigate = useNavigate()

	return <FullscreenOutlined 
		onClick={() => {
			navigate(to, {replace: true})
		}}	
	/>
}

export default NavigateToRoute