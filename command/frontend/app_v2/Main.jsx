import React from "react"
import { useParams, useNavigate } from "react-router-dom"

import { 
	Row,
	Col
} from "antd"
import LiveVideo from "./LiveVideo"
import FileStats from "./FileStats"
import SummaryScrubber from "./SummaryScrubber"
import ProcessList from "./ProcessList"

const routeToIndex = (r) => {
	switch(r){
	case "":
		return 0
	case "live":
		return 1
	case "process":
		return 2
	case "scrub":
		return 3
	case "stats":
		return 4
	default: 
		return 0
	}
}

const Main = () => {
	const {route} = useParams()
	const navigate = useNavigate()
	let index = routeToIndex(route)
    return (
		<Row>
			<Col span={9}>
				<SummaryScrubber />
			</Col>
			<Col span={6}>
				<FileStats />
			</Col>
			<Col span={9}>
				<ProcessList />
			</Col>
        </Row>
    )
}

export default Main