import React, {useState} from 'react';

import { Space, Input, Typography, Button } from "antd"

import cronstrue from 'cronstrue'

const humanReadableCronWithErrorCheck = (cronString) => {
    try {
        return cronstrue.toString(cronString)
    } catch(e){
        return ""
    }
}

const cronErrorCheck = (cronString) => {
    try {
        cronstrue.toString(cronString)
        return false
    } catch(e){
        return true
    }
}

const Scheduler = (props) => {
    const [cronString, setCronString] = useState(props.cronString)

    return (
    <Space direction="vertical">
        <Space>
            <Input 
                value={cronString} 
                onChange={(e) => {
                    const {value} = e.target
                    setCronString(value)
                }}
                placeholder="* * * * *"
            />
            <Button 
                disabled={cronErrorCheck(cronString)}
                onClick={() => props.onEnter(props.url, props.body, cronString)}
            > Schedule </Button>
        </Space>
        <Typography>{humanReadableCronWithErrorCheck(cronString)}</Typography>
    </Space>
    )
}

export default Scheduler