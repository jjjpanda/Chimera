import React from 'react';
import useProcesses from '../hooks/useProcesses.js';

import { List, Card, Space, Button, Modal } from "antd"
import { PlusCircleFilled } from '@ant-design/icons';

import moment from "moment"

const ProcessList = () => {
    const [state, cancelProcess, deleteProcess, toggleModal] = useProcesses()

    const downloadLink = (process) => <Button disabled={process.running} href={process.link}>
        Download
    </Button>

    const endButton = (process) => <Button onClick={() => {
        Modal.confirm({
            title: process.running ? "Cancel" : "Delete",
            content: "Are you sure?",
            okText: "Yes",
            cancelText: "No",
            onOk: () => {
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
                        <Space>
                            Requested: {moment(process.requested, "YYYYMMDD-HHmmss").format("LLL")} <br />
                            Camera: {process.camera} <br />
                            Start: {moment(process.start, "YYYYMMDD-HHmmss").format("LLL")} <br />
                            End: {moment(process.end, "YYYYMMDD-HHmmss").format("LLL")} <br />
                            {(process.running || process.type != "mp4") ? null : <video src={process.link} type="video/mp4" controls/>}
                        </Space>
                    </Card>
                )
            }}
            footer={<Space>
                <Button 
                    onClick={() => {
                        toggleModal({visible: true, processType: "video"})
                    }}
                    icon={<PlusCircleFilled />}
                >
                    Video
                </Button>
                <Button 
                    onClick={() => {
                        toggleModal({visible: true, processType: "zip"})
                    }}
                    icon={<PlusCircleFilled />}
                >
                    Zip
                </Button>
            </Space>}
        />
    )
}

export default ProcessList