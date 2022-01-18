import { useState, useEffect } from "react"

import { request, jsonProcessing } from "./../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"

import useCamDateNumInfo from "./useCamDateNumInfo.js"

const processBody = (state) => {
	const body = JSON.stringify({
		camera: (state.camera+1).toString(),
		start: moment(state.startDate).second(0).format("YYYYMMDD-HHmmss"),
		end: moment(state.endDate).second(0).format("YYYYMMDD-HHmmss"),
		frames: state.number
	})
	return body
}

const updateImages = (state, setState) => {
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
		body: processBody(state)
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			setState((oldState) => ({
				...oldState,
				list: data.list,
				loading: data.list.length > 0,
				sliderIndex: data.list.length-1
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

const usePastImages = () => {
    const [state, setState] = useCamDateNumInfo({
		number: 100,
		numberType: "frames",
		sliderIndex: 99,
		list: ["/res/logo.png"],
		loading: true,
		imagesLoaded: 0,
	})

    const listHasContents = state.list.length > 0
	const stoppable = state.loading && listHasContents
	const allImagesLoaded = !listHasContents || state.imagesLoaded >= state.list.length

    useEffect(() => {
		updateImages(state, setState)
	}, [state.number, state.camera, state.startDate, state.endDate])

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