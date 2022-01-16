import React, { useState, useEffect } from 'react';

import { List, Card, Space, Button, Radio, Modal, message } from "antd"
import { PlusCircleFilled } from '@ant-design/icons';

import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"
import CameraDateNumberPicker from './CameraDateNumberPicker';

import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"

const listProcesses = (setState) => {
    setState((oldState) => ({ 
        ...oldState,
        processList: [], 
        loading: true 
    }))
    request("/convert/listProcess", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            setState((oldState) => ({
                ...oldState,
                processList: [...data.list.sort((process1, process2) => {
                    return moment(process2.requested, "YYYYMMDD-HHmmss").diff(moment(process1.requested, "YYYYMMDD-HHmmss"), "seconds")
                })],
                lastUpdated: moment().format("h:mm:ss a"),
                loading: false
            }))
        })
    })
}

const createProcess = (state, setState, type, toggleModal) => {
    const url = type == "video" ? "/convert/createVideo" : "/convert/createZip"
    if(state.download){
        message.success("Generating", 0)
    }
    request(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: processBody(state)
    }, (prom) => {
        if(state.download){
            downloadProcessing(prom, () => {
                message.destroy()
            })
        }
        else {
            jsonProcessing(prom, (data) => {
                console.log(data)
                toggleModal({visible: false})
                setTimeout(() => {
                    listProcesses(setState)  
                }, 1500)
            })
        }
    })
}

const cancelProcess = (id, setState) => {
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
                listProcesses(setState)  
            }, 1500)
        })
    })
}

const deleteProcess = (id, setState) => {
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
                listProcesses(setState)  
            }, 1500)
        })
    })
}

const processBody = (state) => {
    console.log(state.startDate, state.endDate)
    const body = JSON.stringify({
        camera: (state.camera+1).toString(),
        start: moment(state.startDate).second(0).format("YYYYMMDD-HHmmss"),
        end: moment(state.endDate).second(0).format("YYYYMMDD-HHmmss"),
        skip: state.number,
        save: !state.download
    })
    return body
}

const ProcessList = () => {
    const [state, setState] = useCamDateNumInfo({
		download: false,
        numberType: "speed",
        processList: []
	})

    const [modal, toggleModal] = useState({
        visible: false,
        processType: null
    });

    useEffect(() => {
        if(modal.visible){
            Modal.confirm({
                title: `Create a ${modal.processType}`,
                content: (<Space>
                    <CameraDateNumberPicker 
                        camera={state.camera}
                        cameras={state.cameras}
                        startDate={state.startDate}
                        endDate={state.endDate}
                        number={state.number}
                        numberType={state.numberType}
                        loading={state.disabled}
                        onChange={onChange}
                    />
                </Space>),
                okText: "Close",
                onOk: () => toggleModal({visible: false}),
                cancelButtonProps: {style: {visibility: "hidden"}}
            })
        }
        else{
            Modal.destroyAll()
        }
    }, [modal])

    useEffect(() => {
        if(modal.processType){
            createProcess(state, setState, modal.processType, toggleModal)
        }
    }, [state])

    useEffect(() => {
        listProcesses(setState)
    }, [])
    
    const onChange = (newState) => {
        setState((oldState) => ({
            ...oldState,
            ...newState
        }))
    }

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
                    cancelProcess(process.id, setState)
                }
                else{
                    deleteProcess(process.id, setState)
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