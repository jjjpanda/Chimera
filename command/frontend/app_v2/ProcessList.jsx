import React, { useState, useEffect } from 'react';

import {Tabs, List, Card, Button} from 'antd'
import {RightOutlined, PauseCircleFilled, DeleteFilled, PlayCircleFilled} from '@ant-design/icons'
import CameraDateNumberPicker from './CameraDateNumberPicker.jsx';
import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import cronstrue from 'cronstrue'
const cronParser = require('cron-parser')

const listProcesses = (setState) => {
    setState({
        processList: [],
        loading: true
    })
    request("/convert/listProcess", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            const {tasks} = data
            setState({
                processList: tasks,
                loading: false 
            })
        })
    })
}

const afterRequestCallbackGenerator = (key, setKey) => (prom) => {
    jsonProcessing(prom, (data) => {
        setTimeout(() => {
           setKey(key+1) 
        }, 1500)
    })
}

const restartProcess = (id, key, setKey) => {
    request("/convert/startProcess", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const cancelProcess = (id, key, setKey) => {
    request("/convert/cancelProcess", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const deleteProcess = (id, key, setKey) => {
    request("/convert/deleteProcess", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const ProcessList = (props) => {
    const [state, setState] = useState({
        processList: [],
        loading: false
    })
    const [key, setKey] = useState(0)

    useEffect(() => {
        listProcesses(setState)
    }, [key])

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
                            cancelProcess(item.id, key, setKey)
                        }
                        else{
                            restartProcess(item.id, key, setKey)
                        }
                    }} icon={item.running ? <PauseCircleFilled /> : <PlayCircleFilled />}/>, 
                    <Button onClick={() => {
                        deleteProcess(item.id, key, setKey)
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

export default ProcessList