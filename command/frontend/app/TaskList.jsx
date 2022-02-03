import React from "react"
import useTasks from "../hooks/useTasks.js"

import {Tabs, List, Button} from "antd"
import {RightOutlined, PauseCircleFilled, DeleteFilled, PlayCircleFilled} from "@ant-design/icons"
import NavigateToRoute from "./NavigateToRoute.jsx"

const cronParser = require("cron-parser")
import moment from "moment"
import cronstrue from "cronstrue"

const TaskList = (props) => {
	const [state, restartProcess, stopProcess, deleteProcess] = useTasks()

	const processListSortedUpcoming = [...state.processList.sort((a, b) => {
		const secondsToNowB = moment(cronParser.parseExpression(b.cronString).next().toString()).diff(moment(), "seconds")
		const secondsToNowA = moment(cronParser.parseExpression(a.cronString).next().toString()).diff(moment(), "seconds")
		return secondsToNowA - secondsToNowB
	})]
	const processListSortedAll = [...state.processList.sort((a, b) => a.id.localeCompare(b.id))]

	const processList = (items) => (
		<List
			itemLayout='horizontal'
			dataSource={items}
			renderItem={item => (
				<List.Item actions={[<Button onClick={() => {
					if(item.running){
						stopProcess(item.id)
					}
					else{
						restartProcess(item.id)
					}
				}} icon={item.running ? <PauseCircleFilled /> : <PlayCircleFilled />}/>, 
				<Button onClick={() => {
					deleteProcess(item.id)
				}} icon={<DeleteFilled />}/>]}
				>
					<List.Item.Meta
						title={`Task: ${item.url}`}
						avatar={<RightOutlined />}
						description={`${cronstrue.toString(item.cronString)}`}
					/>
				</List.Item>
			)}     
		/>
	)

	return (<Tabs tabBarExtraContent={{right: (props.withButton ? <NavigateToRoute to={"/process"} /> : null)}}>
		<Tabs.TabPane tab="Upcoming Tasks" key="1">
			{processList(processListSortedUpcoming)}
		</Tabs.TabPane>
		<Tabs.TabPane tab="All Tasks" key="2">
			{processList(processListSortedAll)}
		</Tabs.TabPane>
	</Tabs>)
}

export default TaskList