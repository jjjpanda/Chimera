import React from "react"

import {Radio, DatePicker, InputNumber, Space, Button} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import moment from "moment"

class CameraDateNumberPicker extends React.Component{
    constructor(props){
		super(props)
		this.state ={
			camera: this.props.camera,
            startDate: this.props.startDate,
            endDate: this.props.endDate,
            number: this.props.number
		}
	}

    onReload=()=> {
        this.props.onReload(this.state)
    }

    onCamChange = (e) => {
		//e target.value -> index
		const {value} = e.target
		this.setState(() => ({
			camera: value
		}))
	}

	onDateChange = (e) => {
		//e [moment, moment]
        if(e){
            this.setState(() => ({
                startDate: e[0],
                endDate: e[1]
            }))
        }
		else{
            this.setState(() => ({
                startDate: moment().subtract(1, "day"),
                endDate: moment()
            }))
        }
	}

	onNumberChange = (e) => {
		//e number
		this.setState(() => ({
			number: e
		}))
	}

    render() {
        return (
            <Space direction="vertical">
                <Radio.Group 
                    defaultValue={this.state.camera} 
                    onChange={this.onCamChange}
                    buttonStyle="solid"
                >
                    {this.props.cameras.map((cam, index) => (
                        <Radio.Button value={index}>{cam}</Radio.Button>
                    ))}
                </Radio.Group>
                <DatePicker.RangePicker
                    value={[this.state.startDate, this.state.endDate]}
                    ranges={{
                        'Past Month': [moment().subtract(1, "month"), moment()],
                        'Past Week': [moment().subtract(1, "week"), moment()],
                        'Past Day': [moment().subtract(1, "day"), moment()],
                        'Past Hour': [moment().subtract(1, "hour"), moment()],
                    }}
                    showTime
                    format="YYYY/MM/DD HH:mm:ss"
                    onChange={this.onDateChange}
                />
                <Space>
                    <InputNumber 
                        min={0}
                        value={this.state.number}
                        onChange={this.onNumberChange} 
                        addonAfter={this.props.numberType}
                    />
                    <Button 
                        icon={<ReloadOutlined />}
                        onClick={this.onReload}
                    />
                </Space>
            </Space>
        )
    }
}

export default CameraDateNumberPicker