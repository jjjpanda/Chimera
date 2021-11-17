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
	Card,
	Slider,
	WingBlank,
	ActivityIndicator,
	Progress,
	InputItem
} from "antd-mobile"

import enUsDate from "antd-mobile/lib/date-picker/locale/en_US"
import enUsNumber from "antd-mobile/lib/input-item/locale/en_US"

import {request, jsonProcessing, downloadProcessing} from "./../js/request.js"
import moment from "moment"
import CameraDatePicker from "./CameraDatePicker.jsx"
import Cookies from "js-cookie"
class SummaryScrubber extends React.Component{

	constructor(props){
		super(props)
		this.state ={
			sliderIndex: 100,
			numberOfFrames: 100,
			camera: 0,
			cameras: JSON.parse(process.env.cameras),
			startDate: moment().subtract(1, "day").toDate(),
			endDate: moment().toDate(),
			list: [],
			loading: true,
			imagesLoaded: 0,
		}
	}

	componentDidMount = () => {
		this.updateImages()
	}

	processBody = () => {
		console.log(this.state.startDate, this.state.endDate)
		const body = JSON.stringify({
			camera: (this.state.camera+1).toString(),
			start: moment(this.state.startDate).second(0).format("YYYYMMDD-HHmmss"),
			end: moment(this.state.endDate).second(0).format("YYYYMMDD-HHmmss"),
			frames: this.state.numberOfFrames
		})
		console.log(body)
		return body
	}

	updateImages = () => {
		this.setState({
			list: [],
			loading: true,
			imagesLoaded: 0
		}, () => {
			request("/convert/listFramesVideo", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: this.processBody()
			}, (prom) => {
                
				jsonProcessing(prom, (data) => {
					console.log(data)
					this.setState({
						list: data.list,
						loading: false
					})
				})
            
			})
		})
        
	}

	sliderPlaythrough = () => {
		const setIterate = () => {
			this.setState((oldState) => {
				return {
					sliderIndex: oldState.sliderIndex+1
				}
			}, () => {
				setTimeout(() => {
					if(this.state.sliderIndex < this.state.numberOfFrames - 1){
						setIterate()
					}
				}, 125)
			})
		}
		console.log("ITERATE")
		setIterate()
	}

	render() {
		return (
			<Card>
				<Card.Header 
					title = "Image Preview" 
				/>
				<Card.Body>                    
					{!this.state.loading ? (this.state.list.length > 0 ? this.state.list.map((frame, index) => {
						return (
							<img 
								style={{ display: this.state.sliderIndex == index ? "inherit" : "none"}} 
								src={frame}
								onLoad = {() => {
                                    
									this.setState((oldState) => ({
										imagesLoaded: oldState.imagesLoaded + 1
									}), () => {
										//comment out for no scrubbing autoplay
										/* if(this.state.imagesLoaded >= this.state.list.length){
                                            this.sliderPlaythrough()
                                        } */
										//console.log(Math.round(100 * this.state.imagesLoaded / this.state.list.length))
									})
								}}
							/>
						)
					}) : <div>
                        No Images
					</div>) 
						: <ActivityIndicator />}

					<br />

					{this.state.list.length > 0 && this.state.imagesLoaded < this.state.list.length ? 
						<Progress percent={Math.round(100 * this.state.imagesLoaded / this.state.list.length)} position="normal" /> 
						: <div></div>}
                    
					<CameraDatePicker
						pre ={
							<List.Item>
								<br />
								<WingBlank size="sm">
									<Slider 
										min={0}
										max={Math.min(this.state.numberOfFrames - 1, this.state.list.length - 1)}
										value={this.state.sliderIndex} 
										onChange={(val) => {
											this.setState(() => ({
												sliderIndex: val
											}))
										}}
										disabled={this.state.loading}
									/>
								</WingBlank>
								<br />
							</List.Item>
						}
						post={
							<InputItem 
								type="money" 
								moneyKeyboardAlign="right" 
								value={this.state.numberOfFrames} 
								onChange={(val) => this.setState(() => ({numberOfFrames: Math.max(Math.round(val), 0)}))}
								onVirtualKeyboardConfirm={this.updateImages}
								locale={enUsNumber}
								autoAdjustHeight
							>
                                Frames
							</InputItem>
						}
						camera={this.state.camera}
						cameras={this.state.cameras}
						cameraChange = {(cam) => {
							this.setState(() => {
								return {
									camera: this.state.cameras.findIndex(camera => camera == cam)
								}
							}, () => {
								this.updateImages()
							})
						}}
						startDate={this.state.startDate}
						startChange={date => this.setState({ startDate: date }, () => {
							this.updateImages()
						})}
						endDate={this.state.endDate}
						endChange={date => this.setState({ endDate: date }, () => {
							this.updateImages()
						})}
					/>
				</Card.Body>
			</Card>
		)
	}

}

export default SummaryScrubber