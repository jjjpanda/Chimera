import React from "react"

import { 
	Flex,
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

class TimeRangePicker extends React.Component{

	constructor(props){
		super(props)
	}

	render() {
		return [
			<DatePicker
				mode="time"
				value={this.props.startTime}
				onChange={this.props.startChange}
				use12Hours
			>
				<List.Item arrow="horizontal">
                    Start Time
				</List.Item>
			</DatePicker>,
			<DatePicker
				mode='time'
				value={this.props.endTime}
				onChange={this.props.endChange}
				use12Hours
			>
				<List.Item arrow="horizontal">
                    End Time
				</List.Item>
			</DatePicker>
		]
	}
}

export default TimeRangePicker