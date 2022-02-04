import React from "react"
import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"
import useThemeSwitch from "../hooks/useThemeSwitch"

import {Button, DatePicker, InputNumber, Space, Menu, Dropdown, Typography} from "antd"
import {BackwardOutlined, BackwardFilled, CheckCircleOutlined, CheckCircleFilled, DownOutlined } from "@ant-design/icons"

import moment from "moment"

const CameraDateNumberPicker = (props) => {
	const [state, setState] = useCamDateNumInfo({
		...props,
		modified: false
	})
	const [isDarkTheme] = useThemeSwitch()

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
		setState((oldState) => ({
			...oldState,
			camera: e,
			modified: true
		}))
	}

	const onDateChangeMobileGen = (index) => (e) => {
		// e.target.value
		const {value} = e.target
		setState((oldState) => ({
			...oldState,
			[index == "start" ? "startDate" : "endDate"]: moment(value),
			modified: true
		}))
	}

	const onDateChangeDesktop = (e) => {
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

	const menu = (
		<Menu>
			{props.cameras.map((cam, index) => (
				<Menu.Item>
					<Typography onClick={() => onCamChange(index)}>
						{cam}
					</Typography>
				</Menu.Item>
			))}
		</Menu>
	);

	const desktopDateTimePicker = <DatePicker.RangePicker
		value={[state.startDate, state.endDate]}
		ranges={{
			"Past Month": [moment().subtract(1, "month"), moment()],
			"Past Week": [moment().subtract(1, "week"), moment()],
			"Past Day": [moment().subtract(1, "day"), moment()],
			"Past Hour": [moment().subtract(1, "hour"), moment()],
		}}
		showTime
		format="YYYY/MM/DD HH:mm:ss"
		onChange={onDateChangeDesktop}
	/>

	const mobileDateTimePicker = <div>
		<input 
			style={{backgroundColor: isDarkTheme ? "black" : "white", color: isDarkTheme ? "white" : "black"}}
			type="datetime-local" 
			value={state.startDate.format("YYYY-MM-DDTHH:mm")} 
			onChange={onDateChangeMobileGen("start")}
		/>
		<input 
			style={{backgroundColor: isDarkTheme ? "black" : "white", color: isDarkTheme ? "white" : "black"}}
			type="datetime-local" 
			value={state.endDate.format("YYYY-MM-DDTHH:mm")} 
			onChange={onDateChangeMobileGen("end")}
		/>
	</div>

	const dateTimePicker = props.days ? <InputNumber 
		min={1}
		value={state.days}
		onChange={onDaysChange} 
		addonAfter={"day's worth"}
	/> : (props.mobile ? mobileDateTimePicker : desktopDateTimePicker)

	return (
		<Space direction="vertical">
			<Dropdown overlay={menu} trigger={['click']}>
				<Button icon={<DownOutlined />}>
					{props.cameras[state.camera]} 
				</Button>
			</Dropdown>
			{dateTimePicker}
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