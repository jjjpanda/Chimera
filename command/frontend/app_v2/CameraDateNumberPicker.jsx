import React, { useState } from "react"
import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"

import {Radio, DatePicker, InputNumber, Space, Button} from 'antd'
import {BackwardOutlined, BackwardFilled, CheckCircleOutlined, CheckCircleFilled} from '@ant-design/icons'

import moment from "moment"

const CameraDateNumberPicker = (props) => {
    const [state, setState] = useCamDateNumInfo({
        ...props,
		modified: false
	})

    const onReset=() => {
        setState((oldState) => ({
            ...oldState,
            ...props,
            modified: false
        }))
    }

    const onChange=()=> {
        props.onChange(state)
        setState((oldState) => ({
            ...oldState,
            modified: false
        }))
    }

    const onCamChange = (e) => {
		//e target.value -> index
		const {value} = e.target
		setState((oldState) => ({
            ...oldState,
			camera: value,
            modified: true
		}))
	}

	const onDateChange = (e) => {
		//e [moment, moment]
        if(e){
            setState((oldState) => ({
                ...oldState,
                startDate: e[0],
                endDate: e[1],
                modified: true
            }))
        }
		else{
            setState((oldState) => ({
                ...oldState,
                startDate: moment().subtract(1, "day"),
                endDate: moment(),
                modified: true
            }))
        }
	}

    const onDaysChange = (e) => {
        //e number
		setState((oldState) => ({
            ...oldState,
			days: e,
            modified: true
		}))
    }

	const onNumberChange = (e) => {
		//e number
		setState((oldState) => ({
            ...oldState,
			number: e,
            modified: true
		}))
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
            {props.days ? <InputNumber 
                min={1}
                value={state.days}
                onChange={onDaysChange} 
                addonAfter={"day's worth"}
            /> : <DatePicker.RangePicker
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
            />}
            <Space>
                <InputNumber 
                    min={1}
                    value={state.number}
                    onChange={onNumberChange} 
                    addonAfter={props.numberType}
                />
                <Button 
                    icon={state.modified ? <BackwardFilled /> : <BackwardOutlined />}
                    onClick={onReset}
                />
                <Button 
                    icon={state.modified ? <CheckCircleFilled /> : <CheckCircleOutlined />}
                    onClick={onChange}
                    disabled={props.disabled}
                />
            </Space>
        </Space>
    )
}

export default CameraDateNumberPicker