import { useState, useEffect } from "react"
import useCamDateNumInfo from "./useCamDateNumInfo.js"
import useCameras from "./useCameras.js"

import moment from "moment"

import { request, jsonProcessing } from "./../js/request.js"

const processBody = (state, camId) => {
	const body = JSON.stringify({
		camera: String(camId),
		start: moment(state.startDate).utc().format("YYYYMMDD-HHmmss"),
		end: moment(state.endDate).utc().format("YYYYMMDD-HHmmss"),
		frames: state.number
	})
	return body
}

const updateImages = (state, setState, cameras) => {
	const camId = cameras[state.camera]?.id
	if (camId == null) return
	setState((oldState) => ({
		...oldState,
		list: ["/res/logo.png"],
		loading: true,
		imagesLoaded: 0
	}))
	request("/convert/listFramesVideo", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: processBody(state, camId)
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			const list = data && Array.isArray(data.list) ? data.list : []
			setState((oldState) => ({
				...oldState,
				list,
				loading: list.length > 0,
				sliderIndex: list.length-1
			}))
		})
	})
}

const onReloadGenerator = (setState) => (newState) => {
	setState((oldState) => ({
		...oldState,
		camera: newState.camera,
		startDate: newState.startDate,
		endDate: newState.endDate,
		number: newState.number
	}))
}

const usePastImages = (numberOfFrames = 100) => {
	const [cameras] = useCameras()
	const [state, setState] = useCamDateNumInfo({
		number: numberOfFrames,
		numberType: "frames",
		sliderIndex: numberOfFrames-1,
		list: ["/res/logo.png"],
		loading: true,
		imagesLoaded: 0,
	})

	const listHasContents = state.list.length > 0
	const stoppable = state.loading && listHasContents
	const allImagesLoaded = !listHasContents || state.imagesLoaded >= state.list.length

	useEffect(() => {
		updateImages(state, setState, cameras)
	}, [state.number, state.camera, state.startDate, state.endDate, cameras])

	useEffect(()=> {
		if( allImagesLoaded ){
			setState((oldState) => ({
				...oldState,
				loading: false,
				imagesLoaded: 0
			}))
		}
	}, [state.imagesLoaded])

	return [state, setState, listHasContents, stoppable, onReloadGenerator(setState)]
}

export default usePastImages