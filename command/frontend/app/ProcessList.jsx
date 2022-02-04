import React from "react"
import useProcesses from "../hooks/useProcesses.js"

import { List, Card, Space, Button, Modal, Typography } from "antd"
import { PlusCircleFilled } from "@ant-design/icons"
import NavigateToRoute from "./NavigateToRoute.jsx"

import moment from "moment"

const ProcessList = (props) => {
	const [state, cancelProcess, deleteProcess, toggleModal] = useProcesses({
		mobile: props.mobile
	})

	const downloadLink = (process) => <Button disabled={process.running} href={process.link}>
        Download
	</Button>

	const endButton = (process) => <Button onClick={() => {
		Modal.confirm({
			title: process.running ? "Cancel" : "Delete",
			content: "Are you sure?",
			okText: "No",
			cancelText: "Yes",
			onCancel: () => {
				if(process.running){
					cancelProcess(process.id)
				}
				else{
					deleteProcess(process.id)
				}
			}
		})
	}}>{process.running ? "Cancel" : "Delete"}</Button>

	return (
		<Card
			title={"Processes"}
			extra={ (props.withButton ? <NavigateToRoute to={"/process"} /> : null) }
			size="small"
		>
			<List 
				dataSource={state.processList}
				renderItem={process => {
					const requestedTime = moment(process.requested, "YYYYMMDD-HHmmss").format("LLL")
					const startTime = moment(process.start, "YYYYMMDD-HHmmss").format("LLL")
					const endTime = moment(process.end, "YYYYMMDD-HHmmss").format("LLL")
					return (
						<Card 
							size="small"
							extra={process.running ? "Running" : null}
							title={`${(process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???"))} | ${requestedTime} `}
							actions={[downloadLink(process), endButton(process)]}
						>
							<Space direction={"vertical"}>
								<Typography>Camera: {process.camera} </Typography>
								<Typography>Start: {startTime} </Typography>
								<Typography>End: {endTime} </Typography>
								{(process.running || props.mobile || process.type != "mp4") ? null : <video src={process.link} type="video/mp4" controls/>}
							</Space>
						</Card>
					)
				}}
				footer={props.showFooter ? <Space direction="vertical" align="center" style={{width: "100%", textAlign: "center"}}>
					<Space>
						<Button 
							onClick={() => {
								toggleModal({visible: true, processType: "video", days: false})
							}}
							icon={<PlusCircleFilled />}
						>
							Video
						</Button>
						<Button 
							onClick={() => {
								toggleModal({visible: true, processType: "zip", days: false})
							}}
							icon={<PlusCircleFilled />}
						>
							Zip
						</Button>
					</Space>
					<Space>
						<Button 
							onClick={() => {
								toggleModal({visible: true, processType: "video", days: true})
							}}
							icon={<PlusCircleFilled />}
						>
							Scheduled Video
						</Button>
						<Button 
							onClick={() => {
								toggleModal({visible: true, processType: "zip", days: true})
							}}
							icon={<PlusCircleFilled />}
						>
							Scheduled Zip
						</Button>
					</Space>
				</Space> : null}
			/>
		</Card>
	)
}

export default ProcessList