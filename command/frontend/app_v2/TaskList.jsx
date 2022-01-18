import React, { useState, useEffect } from 'react';

import {Tabs, List, Card, Button} from 'antd'
import {RightOutlined, PauseCircleFilled, DeleteFilled, PlayCircleFilled} from '@ant-design/icons'
import moment from "moment"
import cronstrue from 'cronstrue'
import useTasks from '../hooks/useTasks.js';
const cronParser = require('cron-parser')

const TaskList = (props) => {
    const [state, restartProcess, cancelProcess, deleteProcess] = useTasks()

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
                            cancelProcess(item.id)
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

    return (<Tabs tabBarExtraContent={{right: <Button />}}>
        <Tabs.TabPane tab="Upcoming" key="1">
            {processList(processListSortedUpcoming)}
        </Tabs.TabPane>
        <Tabs.TabPane tab="All" key="2">
            {processList(processListSortedAll)}
        </Tabs.TabPane>
    </Tabs>)
}

export default TaskList