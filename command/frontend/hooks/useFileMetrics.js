import React, {useEffect, useState} from 'react';

import { InputNumber, Modal } from 'antd'

import moment from "moment"
import {request, jsonProcessing} from "../js/request.js"

const DeleteDaysInput = (props) => {
	return <InputNumber 
		min={0}
		addonBefore={`Delete files older than`}
		addonAfter={"days"}
		defaultValue={props.default}
		onChange={(value) => props.onChange(value)}
	/>
}

const cameraUpdate = (setState) => {
	setState((oldState) => ({
		...oldState,
		loading: "refreshing",
		lastUpdated: moment().format("h:mm:ss a")
	}))
	request("/file/pathMetrics", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data && "count" in data && "size" in data){
				setState((oldState) => ({
					...oldState,
					cameras: oldState.cameras.map((camera) => ({
						...camera,
						size: parseInt(data.size[camera.name]),
						count: parseInt(data.count[camera.name])
					})),
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			}
			else{
				setState((oldState) => ({
					...oldState,
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			}
		})
	})
}

const deleteFiles = (state, setState, camera=undefined) => {
	setState((oldState) => ({
		...oldState,
		loading: "deleting"
	}))
	if(camera != undefined){
		request("/file/pathClean", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				camera,
				days: state.days
			})
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				cameraUpdate(setState)
			})
		})
	}
	else{
		Promise.all(state.cameras.map((camera) => {
			request("/file/pathClean", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					camera: camera.number,
					days: state.days
				})
			}, (prom) => {
				jsonProcessing(prom, (data) => {
					resolve()
				})
			}) 
		})).then(() => cameraUpdate(setState))
	}
}

const useFileMetrics = (initialState) => {
    const [state, setState] = useState(initialState)

    useEffect(() => {
		cameraUpdate(setState)
	}, [])

    const handleDelete = ({name, number, target}) => {
		console.log(name, number, target)
		if(name && number){
			Modal.confirm({
				title:`Delete Files from Camera: ${name}?`,
				content: (<DeleteDaysInput 
					default={state.days}
					onChange={(value) => setState((oldState) => ({...oldState, days: value}))}
				/>),
				okText: "Yes",
				cancelText: "No",
				onOk: () => {
					console.log("DELETE", name, state.days)
					deleteFiles(state, setState, number)
				}
			})
		}
		else{
			Modal.confirm({
				title:`Delete Files from All Cameras?`,
				content: (<DeleteDaysInput 
					default={state.days}
					onChange={(value) => setState((oldState) => ({...oldState, days: value}))}
				/>),
				okText: "Yes",
				cancelText: "No",
				onOk: () => {
					console.log("DELETE ALL", state.days)
					deleteFiles(state, setState)
				}
			})
		}
	}

    return [state, setState, handleDelete]
}

export default useFileMetrics