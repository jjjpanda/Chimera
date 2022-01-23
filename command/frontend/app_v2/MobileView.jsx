import React from "react"

import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"

const MobileView = (props) => {
    const {index} = props

    if(index == "route-1"){
        return <LiveVideo list/>
    }
    else if(index == "route-2"){
        return [<ProcessList showFooter />, <TaskList />]
    }
    else if(index == "route-3"){
        return <SummaryScrubber />
    }
    else if(index == "route-4"){
        return [
            <div style={{height: "400px", display: "flex"}}>
                <FileStatsLineChart />
            </div>,
            <div style={{height: "400px", display: "flex"}}>
                <FileStatsPieChart />
            </div>
        ]
    }
    return [        
        <SummaryScrubber />,
        <ProcessList />,
        <TaskList />
    ]
}

export default MobileView