import React from "react"

import { 
	Flex,
	Modal, 
	Button,
	Selector,
	DatePicker,
	List,
	Checkbox,
	WhiteSpace,
	Toast
} from "antd-mobile"

/**
 * @deprecated
 */
class CameraDatePicker extends React.Component {
	constructor(props){
		super(props)
	}

	render () {
		return (
			<List>
				{this.props.pre}

				<List.Item>
					<div>Camera</div>
					<Selector
						value={this.props.camera}
						options={this.props.cameras}
						onChange = {this.props.cameraChange}
					/>
				</List.Item>

				<DatePicker
					value={this.props.startDate}
					onChange={this.props.startChange}
				>
					<List.Item arrow="horizontal">
                        Start Date
					</List.Item>
				</DatePicker>
            
				<DatePicker
					value={this.props.endDate}
					onChange={this.props.endChange}
				>
					<List.Item arrow="horizontal">
                        End Date
					</List.Item>
				</DatePicker>
 
				{this.props.post}
			</List>
		)
	}
}

export default CameraDatePicker