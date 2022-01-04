import React from "react"

import { 
	Space,
	Modal, 
	Button,
	SegmentedControl,
	DatePicker,
	List,
	Checkbox,
	Toast,
	Input
} from "antd-mobile"

import {request, jsonProcessing, downloadProcessing} from "./../js/request.js"
import moment from "moment"
import CameraDatePicker from "./CameraDatePicker.jsx"
import Cookies from "js-cookie"
class SaveProcess extends React.Component{

	constructor(props){
		super(props)
		this.state ={
			camera: 0,
			cameras: JSON.parse(process.env.cameras),
			visible: false,
			startDate: moment().subtract(1, "day").toDate(),
			endDate: moment().toDate(),
			skip: 1,
			download: false,
		}
	}

	processBody = () => {
		console.log(this.state.startDate, this.state.endDate)
		const body = JSON.stringify({
			camera: (this.state.camera+1).toString(),
			start: moment(this.state.startDate).second(0).format("YYYYMMDD-HHmmss"),
			end: moment(this.state.endDate).second(0).format("YYYYMMDD-HHmmss"),
			skip: this.state.skip,
			save: !this.state.download
		})
		console.log(body)
		return body
	}

	createVideo = () => {
		if(this.state.download){
			Toast.loading("Generating", 0)
		}
		request("/convert/createVideo", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: this.processBody()
		}, (prom) => {
			if(this.state.download){
				downloadProcessing(prom, () => {
					this.closeModal()
				})
			}
			else {
				jsonProcessing(prom, (data) => {
					console.log(data)
					this.closeModal()
				})
			}
		})
	}

	createZip = () => {
		if(this.state.download){
			Toast.loading("Generating", 0)
		}
		request("/convert/createZip", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: this.processBody()
		}, (prom) => {
			if(this.state.download){
				downloadProcessing(prom, () => {
					this.closeModal()
				})
			}
			else {
				jsonProcessing(prom, (data) => {
					console.log(data)
					this.closeModal()
				})
			}
		})
	}

	openModal = () => {
		this.setState(() => ({visible: true}))
	}

	closeModal = () => {
		this.setState(() => ({visible: false}), this.props.update)
	}

	render () {
		console.log(this.state)
		return (
			<Space>
				<Button icon="check-circle-o" onClick={this.openModal}>
                    SAVE VIDEO/ZIP
				</Button>
				<Modal
					popup
					maskClosable
					visible={this.state.visible}
					onClose={this.closeModal}
					animationType="slide-up"
				>
					<CameraDatePicker 
						camera={this.state.camera}
						cameras={this.state.cameras}
						cameraChange = {(cam) => {
							this.setState(() => {
								return {
									camera: this.state.cameras.findIndex(camera => camera == cam)
								}
							})
						}}
						startDate={this.state.startDate}
						startChange={date => this.setState({ startDate: date })}
						endDate={this.state.endDate}
						endChange={date => this.setState({ endDate: date })}
						post={[
							<Input 
								value={this.state.skip}
								extra={"Frame Skipping"}
								onChange = {(val) => this.setState({ skip: val })}
							>
                                Skip
							</Input>,
							<Checkbox.CheckboxItem 
								checked={this.state.download} 
								onChange={(e) => this.setState({ download : e.target.checked })} 
							>
                                Direct Download
							</Checkbox.CheckboxItem>
						]}
					/>

					<Space>
						<Space>
							<Button icon="check-circle-o" onClick={this.createVideo}>VIDEO</Button>
						</Space>
						<Space>
							<Button icon="check-circle-o" onClick={this.createZip}>ZIP</Button>
						</Space>
					</Space>

				</Modal>
			</Space>
		)
	}

}

export default SaveProcess