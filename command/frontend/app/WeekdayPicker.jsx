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

class WeekdayPicker extends React.Component{

	constructor(props){
		super(props)
	}

	render() {
		return [
			...Object.entries(this.props.weekdays).map(([weekday, checked]) => {
				return (<Checkbox.CheckboxItem key={weekday} checked={checked} onChange={(e) => {
					this.props.onChange(weekday, e.target.checked)
				}}>
					{weekday}
				</Checkbox.CheckboxItem>)
			}),
			<Checkbox.CheckboxItem key={"all"} checked={Object.values(this.props.weekdays).every((checked) => checked)} onChange={(e) => {
				if(e.target.checked){
					this.props.onChange({
						Sunday:     true,
						Monday:     true,
						Tuesday:    true,
						Wednesday:  true,
						Thursday:   true,
						Friday:     true,
						Saturday:   true,
					})
				}
				else{
					this.props.onChange({
						Sunday:     false,
						Monday:     false,
						Tuesday:    false,
						Wednesday:  false,
						Thursday:   false,
						Friday:     false,
						Saturday:   false,
					})
				}
			}}>
                All
			</Checkbox.CheckboxItem>
		]
	}
}

export default WeekdayPicker