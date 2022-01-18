import React, {useEffect, useState} from 'react';

import { Space, Modal, message } from "antd"
import {request, jsonProcessing} from "../js/request.js"
import CameraDateNumberPicker from '../app_v2/CameraDateNumberPicker';

import moment from "moment"

import useCamDateNumInfo from "./useCamDateNumInfo.js"

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

const cancelProcessGenerator = (setState) => (id) => {
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

const deleteProcessGenerator = (setState) => (id) => {
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

const useProcesses = () => {
    const [state, setState] = useCamDateNumInfo({
		download: false,
        numberType: "speed",
        processList: []
	})

    const [modal, toggleModal] = useState({
        visible: false,
        processType: null
    });

    const onChange = (newState) => {
        setState((oldState) => ({
            ...oldState,
            ...newState
        }))
    }

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

    return [state, cancelProcessGenerator(setState), deleteProcessGenerator(setState), toggleModal]
}

export default useProcesses