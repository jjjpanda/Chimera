import React from "react"

import { 
	Button,
	List,
	Card,
	PullToRefresh,
	NoticeBar,
	Flex,
	Modal,
	Space
} from "antd-mobile"

import {
	CheckCircleOutline
} from 'antd-mobile-icons'

import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import SaveProcess from "./SaveProcess.jsx"
import MotionProcess from "./MotionProcess.jsx"
import alertModal from "./Alert.jsx"
import ScheduleMotion from "./ScheduleMotion.jsx"
import Cookies from "js-cookie"
class MotionRecording extends React.Component{

	constructor(props){
		super(props)
		this.state = {
			loading: false,
			lastUpdated: moment().format("h:mm:ss a"),
			processList: []
		}
	}

	componentDidMount = () => {
		this.listProcesses()
	} 

	listProcesses = () => {
		this.setState({ processList: [], loading: true }, () => {
			request("/convert/listProcess", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				}
			}, (prom) => {
				jsonProcessing(prom, (data) => {
					console.log(data)
					this.setState(() => {
						return{
							processList: [...data.list.sort((process1, process2) => {
								return moment(process2.requested, "YYYYMMDD-HHmmss").diff(moment(process1.requested, "YYYYMMDD-HHmmss"), "seconds")
							})],
							lastUpdated: moment().format("h:mm:ss a"),
							loading: false
						}
					})
				})
			})
		})
        
	}

	cancelProcess = (id, type) => {
		request("/convert/cancelProcess", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
				setTimeout(() => {
					this.listProcesses()  
				}, 1500)
			})
		})
        
	}

	deleteProcess = (id, type) => {
		request("/convert/deleteProcess", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				console.log(data)
				setTimeout(() => {
					this.listProcesses()  
				}, 1500)
			})
		})

	}

	render () {
		console.log("STATE FROM PROCESSES", this.state)
		return (
            
			<Card>
				<Card.Header
					title = "Processes" 
					extra={<Button size="small" loading={this.state.loading} disabled={this.state.loading} onClick={this.listProcesses}>
                            Refresh{this.state.loading ? "ing" : ""}
					</Button>}
				/>
				<Card.Body>                    
					<NoticeBar mode="closable" icon={<CheckCircleOutline />}>
                        Last Updated Date: {this.state.lastUpdated}
					</NoticeBar>

					<ScheduleMotion update ={this.listProcesses} />

					<MotionProcess key={`motion${this.state.lastUpdated}`}/>
                    
					<SaveProcess update={this.listProcesses}/>    

					{this.state.processList.map(process => {
						return (
							<Card >
								<Card.Header 
									extra={<div>
										{process.running ? null : <a href={process.link} download>
											<Button size="small" inline>
                                                Download
											</Button>
										</a>}
										<Button type="ghost" size="small" inline onClick={() => {
											alertModal(process.running ? "Cancel" : "Delete", "Are you sure?", () => {
												if(process.running){
													this.cancelProcess(process.id)
												}
												else{
													this.deleteProcess(process.id)
												}
											})
										}}>{process.running ? "Cancel" : "Delete"}</Button>
									</div>
									}
									title={process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
								/>
								<Space>
                                        Requested: {moment(process.requested, "YYYYMMDD-HHmmss").format("LLL")} <br />
                                        Camera: {process.camera} <br />
                                        Start: {moment(process.start, "YYYYMMDD-HHmmss").format("LLL")} <br />
                                        End: {moment(process.end, "YYYYMMDD-HHmmss").format("LLL")} <br />
									{(process.running || process.type != "mp4") ? null : <video src={process.link} type="video/mp4" controls/>}
								</Space>
								<br />
								<Card.Footer 
									content={<div>{process.running ? "Running" : null}</div>} 
								/>  
							</Card>
						)
					})}    
				</Card.Body>     
			</Card>      
		)
	}
}

export default MotionRecording