import React, { useState, useEffect } from 'react';

import { List, Card, Space, Button, Modal } from "antd"

import {request, jsonProcessing} from "../js/request.js"
import moment from "moment"

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

const ProcessList = () => {
    const [state, setState] = useState({
        loading: false,
        lastUpdated: moment().format("h:mm:ss a"),
        processList: []
    })

    useEffect(() => {
        listProcesses(setState)
    }, [])

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
        />
    )
}

export default ProcessList