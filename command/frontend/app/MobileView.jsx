import React from "react"

import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"
import StatusTree from "./StatusTree"

const MobileView = (props) => {
	const {index} = props

	if(index == "route-1"){
		return <LiveVideo list/>
	}
	else if(index == "route-2"){
		return [<ProcessList showFooter mobile />, <TaskList />]
	}
	else if(index == "route-3"){
		return <SummaryScrubber mobile />
	}
	else if(index == "route-4"){
		return [
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsPieChart mobile />
			</div>,
			<div style={{height: "400px", display: "flex"}}>
				<FileStatsLineChart mobile />
			</div>
		]
	}
	return [      
		<LiveVideo mobile />,
		<SummaryScrubber numberOfFrames={10} withButton mobile/>,
		<StatusTree />
	]
}

export default MobileView