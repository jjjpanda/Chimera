import React from "react"
import { useParams, useNavigate } from "react-router-dom"

import { 
	Space
} from "antd"

const routeToIndex = (r) => {
	switch(r){
	case "live":
		return 0
	case "process":
		return 1
	case "scrub":
		return 2
	case "stats":
		return 3
	default: 
		return 0
	}
}

const Main = () => {
	const {route} = useParams()
	const navigate = useNavigate()
	let index = routeToIndex(route)
    return (
		<Space>
            {index}
            {route}
        </Space>
    )
}

export default Main