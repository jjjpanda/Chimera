import React from "react"

import {Checkbox} from "antd"

const WeekdayPicker = (props) => {
	return (
		<Checkbox.Group 
			options={this.props.weekdays}
			value={this.props.weekdays.filter((day) => day.checked).map(day => day.value)}
			onChange={(checkedArr) => {
				this.props.onChange(this.props.weekdays.map(({label, value}) => {
					return {
						label,
						value,
						checked: checkedArr.includes(value)
					}
				}))
			}} 
		/>
	)
}

export default WeekdayPicker