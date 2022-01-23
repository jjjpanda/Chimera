import React from "react"

import { Row, Col, Space } from "antd"
import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"

const DesktopView = (props) => {
    const {index} = props

    if(index == "route-1"){
        return <LiveVideo grid />
    }
    else if(index == "route-2"){
        return <></>
    }
    else if(index == "route-3"){
        return <></>
    }
    else if(index == "route-4"){
        return <></>
    }
    else{
        return (
            <Space direction="vertical">
                <Row>
                    <Col span={9}>
                        <FileStatsPieChart />
                    </Col>
                    <Col span={9}>
                        <ProcessList />
                    </Col>
                    <Col span={6}>
                        <FileStatsLineChart />
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        <SummaryScrubber />
                    </Col>
                    <Col span={5}>
                        <TaskList />
                    </Col>
                    <Col span={7}>
                        <LiveVideo />
                    </Col>
                </Row>
            </Space>
        )
    }
    
}

export default DesktopView