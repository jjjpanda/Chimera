import React from "react"

import { 
	Space,
	Modal, 
	Button,
	SegmentedControl,
	DatePicker,
	List,
	Checkbox,
	WhiteSpace,
	Toast,
	InputItem
} from "antd-mobile"

import {request, jsonProcessing} from "./../js/request.js"
import moment from "moment"
import TimeRangePicker from "./TimeRangePicker.jsx"
import WeekdayPicker from "./WeekdayPicker.jsx"
import { cronString, cronState } from "../js/lib/cronString.js"
import Cookies from "js-cookie"
class ScheduleMotion extends React.Component{

	constructor(props){
		super(props)
		this.state ={
			weekdays: {
				Sunday:     true,
				Monday:     true,
				Tuesday:    true,
				Wednesday:  true,
				Thursday:   true,
				Friday:     true,
				Saturday:   true,
			},
			startTime: moment().toDate(),
			endTime: moment().toDate(),
			visible: false,
			running: false,
		}
	}

	componentDidMount = () => {
		this.updateScheduling()
	}

	updateScheduling = () => {
		request("/task/check", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStart"
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
				this.setState(() => {
					const {
						weekdays,
						date,
						running
					} = cronState(data.cronString)
					return {
						weekdays,
						startTime: date,
						running
					}
				})
			})
		})
		request("/task/check", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStop"
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
				this.setState(() => {
					const {
						weekdays,
						date,
						running
					} = cronState(data.cronString)
					return {
						weekdays,
						endTime: date,
						running
					}
				})
            
			})
		})
	}

	openModal = () => {
		this.setState(() => ({visible: true}))
	}

	closeModal = () => {
		this.setState(() => ({visible: false}), this.props.update)
	}

	stopTask = () => {
		request("/task/destroy", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStart"
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
			})
			this.updateScheduling()
		})
		request("/task/destroy", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStop"
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
			})
			this.updateScheduling()
		})
	}

	startTask = () => {
		console.log(cronString(this.state.weekdays, this.state.startTime), cronString(this.state.weekdays, this.state.endTime))
		request("/task/schedule", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStart",
				cronString: cronString(this.state.weekdays, this.state.startTime),
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
			})
			this.updateScheduling()
		})
		request("/task/schedule", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: "/motionStop",
				cronString: cronString(this.state.weekdays, this.state.endTime),
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
			})
			this.updateScheduling()
		})
	}

	render () {
		return (<Space>
			<Button icon="check-circle-o" onClick={this.openModal}>
                SCHEDULE
			</Button>
			<Modal
				popup
				maskClosable
				visible={this.state.visible}
				onClose={this.closeModal}
				animationType="slide-up"
			>
				<List>
					<List.Item
						arrow="down"
						onClick={this.closeModal}
					>
                        Scheduling: {this.state.running ? "On" : "Off"}
					</List.Item>
					<WeekdayPicker weekdays={this.state.weekdays} onChange = {(weekday, checked) => {
						if(checked != undefined){
							this.setState((oldState) => {
								oldState.weekdays[weekday] = checked
								return { weekdays: oldState.weekdays }
							})
						}
						else{
							this.setState(() => {
								return { weekdays: weekday }
							})
						}
					}}/>
					<TimeRangePicker 
						startTime= {this.state.startTime}
						startChange = {time => this.setState({ startTime: time })}
						endTime= {this.state.endTime}
						endChange = {time => this.setState({ endTime: time })}
					/>
                    
				</List>
				<Space>
					<Space>
						<Button icon="check-circle-o" onClick={this.stopTask}>STOP</Button>
					</Space>
					<Space>
						<Button icon="check-circle-o" onClick={this.startTask}>START</Button>
					</Space>
				</Space>
			</Modal>
		</Space>)
	}

}

export default ScheduleMotion