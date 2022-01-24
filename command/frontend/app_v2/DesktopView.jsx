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
        return <Row>
            <Col span={18}>
                <ProcessList showFooter />
            </Col>
            <Col span={6}>
                <TaskList />
            </Col>
        </Row>
    }
    else if(index == "route-3"){
        return <Space direction="vertical" style={{width: "100%"}}>
            <SummaryScrubber />
        </Space> 
    }
    else if(index == "route-4"){
        return <Space direction="vertical" style={{width: "100%"}}>
            <Row>
                <Col span={6} style={{height: "80vh"}}>
                    <FileStatsPieChart />
                </Col>
                <Col span={2}>
                </Col>
                <Col span={16}>
                    <FileStatsLineChart />
                </Col>
            </Row>
        </Space>
    }
    else{
        return (
            <Space direction="vertical">
                <Row style={{minHeight: "50vh"}}>
                    <Col span={8}>
                        <div>STATUS</div>
                    </Col>
                    <Col span={8}>
                        <FileStatsPieChart withButton/>
                    </Col>
                    <Col span={8}>
                        <LiveVideo />
                    </Col>
                </Row>
                <Row>
                    <Col span={6}>
                        <ProcessList />
                    </Col>
                    <Col span={6}>
                        <TaskList withButton/>
                    </Col>
                    <Col span={2}>
                    </Col>
                    <Col span={10}>
                        <SummaryScrubber numberOfFrames={10} withButton />
                    </Col>
                </Row>
            </Space>
        )
    }
    
}

export default DesktopView