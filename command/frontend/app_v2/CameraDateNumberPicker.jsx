import React, { useState } from "react"

import {Radio, DatePicker, InputNumber, Space, Button} from 'antd'
import {CloseCircleOutlined, CloseCircleFilled, CheckCircleOutlined, CheckCircleFilled} from '@ant-design/icons'
import moment from "moment"

const CameraDateNumberPicker = (props) => {
    const [state, setState] = useState({
        camera: props.camera,
        startDate: props.startDate,
        endDate: props.endDate,
        number: props.number,
        modified: false
    })

    const onReset=() => {
        setState({
            camera: props.camera,
            startDate: props.startDate,
            endDate: props.endDate,
            number: props.number,
            modified: false
        })
    }

    const onChange=()=> {
        props.onChange(state)
        setState({
            ...state,
            modified: false
        })
    }

    const onCamChange = (e) => {
		//e target.value -> index
		const {value} = e.target
		setState({
            ...state,
			camera: value,
            modified: true
		})
	}

	const onDateChange = (e) => {
		//e [moment, moment]
        if(e){
            setState({
                ...state,
                startDate: e[0],
                endDate: e[1],
                modified: true
            })
        }
		else{
            setState({
                ...state,
                startDate: moment().subtract(1, "day"),
                endDate: moment(),
                modified: true
            })
        }
	}

	const onNumberChange = (e) => {
		//e number
		setState({
            ...state,
			number: e,
            modified: true
		})
	}

    return (
        <Space direction="vertical">
            <Radio.Group 
                value={state.camera} 
                onChange={onCamChange}
                buttonStyle="solid"
            >
                {props.cameras.map((cam, index) => (
                    <Radio.Button value={index}>{cam}</Radio.Button>
                ))}
            </Radio.Group>
            <DatePicker.RangePicker
                value={[state.startDate, state.endDate]}
                ranges={{
                    'Past Month': [moment().subtract(1, "month"), moment()],
                    'Past Week': [moment().subtract(1, "week"), moment()],
                    'Past Day': [moment().subtract(1, "day"), moment()],
                    'Past Hour': [moment().subtract(1, "hour"), moment()],
                }}
                showTime
                format="YYYY/MM/DD HH:mm:ss"
                onChange={onDateChange}
            />
            <Space>
                <InputNumber 
                    min={0}
                    value={state.number}
                    onChange={onNumberChange} 
                    addonAfter={props.numberType}
                />
                <Button 
                    icon={state.modified ? <CloseCircleFilled /> : <CloseCircleOutlined />}
                    onClick={onReset}
                />
                <Button 
                    icon={state.modified ? <CheckCircleFilled /> : <CheckCircleOutlined />}
                    onClick={state.modified ? onChange: () => {}}
                    disabled={props.loading}
                />
            </Space>
        </Space>
    )
}

export default CameraDateNumberPicker