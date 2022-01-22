import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { Row, Col, Layout, Menu } from "antd"
const { Sider, Content } = Layout
import {PieChartOutlined, DesktopOutlined ,FileOutlined } from '@ant-design/icons'
import LiveVideo from "./LiveVideo"
import FileStatsPieChart from "./FileStatsPieChart.jsx"
import FileStatsLineChart from "./FileStatsLineChart.jsx"
import SummaryScrubber from "./SummaryScrubber"
import TaskList from "./TaskList"
import ProcessList from "./ProcessList"

import routeToIndex from "../js/routeToIndex";

const Main = () => {
	const [collapsed, setCollapsed] = useState(false)

	const {route} = useParams()
	const navigate = useNavigate()
	let index = routeToIndex(route)
    return (
		<Layout style={{minHeight: "100vh"}}>
			<Sider
				collapsible 
				collapsed={collapsed} 
				onCollapse={(c) => setCollapsed(c)}
			>
				<div className="logo" />
				<Menu theme="dark" defaultSelectedKeys={['1']}>
					<Menu.Item key="1" icon={<PieChartOutlined />}>
						Option 1
					</Menu.Item>
					<Menu.Item key="2" icon={<DesktopOutlined />}>
						Option 2
					</Menu.Item>
					<Menu.Item key="9" icon={<FileOutlined />}>
						Files
					</Menu.Item>
				</Menu>
			</Sider>
			<Layout>
				<Content>
					<Row>
						<Col span={9}>
							<FileStatsPieChart />
						</Col>
						<Col span={9}>
							<FileStatsLineChart />
						</Col>
						<Col span={6}>
							<ProcessList />
						</Col>
					</Row>
				</Content>
			</Layout>
		</Layout>
		
    )
}

export default Main