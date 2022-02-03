import React from "react"
import useProcesses from "../hooks/useProcesses.js"

import { List, Card, Space, Button, Modal } from "antd"
import { PlusCircleFilled } from "@ant-design/icons"

import moment from "moment"

const ProcessList = (props) => {
	const [state, cancelProcess, deleteProcess, toggleModal] = useProcesses()

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
		<List 
			header={"Processes"}
			dataSource={state.processList}
			renderItem={process => {
				return (
					<Card 
						extra={process.running ? "Running" : null}
						title={process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
						actions={[downloadLink(process), endButton(process)]}
					>
						<Space direction={"vertical"}>
                            <Typography>Requested: {moment(process.requested, "YYYYMMDD-HHmmss").format("LLL")} </Typography>
                            <Typography>Camera: {process.camera} </Typography>
                            <Typography>Start: {moment(process.start, "YYYYMMDD-HHmmss").format("LLL")} </Typography>
                            <Typography>End: {moment(process.end, "YYYYMMDD-HHmmss").format("LLL")} </Typography>
							{(process.running || props.mobile || process.type != "mp4") ? null : <video src={process.link} type="video/mp4" controls/>}
						</Space>
					</Card>
				)
			}}
			footer={props.showFooter ? <Space direction="vertical">
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
	)
}

export default ProcessList