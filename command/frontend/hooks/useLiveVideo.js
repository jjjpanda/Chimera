import {useEffect, useState} from "react"

import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"

const listVideos = (state, setState) => {
	setState((oldState) => ({
		...oldState,
		loading: true,
		videoList: []
	}))
	request("/livestream/status", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		mode: "cors"
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			console.log(data)
			if(DataTransferItemList){
				setState((oldState) => ({
					...oldState,
					loading: false,
					videoList: data.map((cam) => parseInt(cam.name.split("_")[3])).sort((camNumA, camNumB) => {
						return camNumA - camNumB
					}).map((num) => ({
						camera: oldState.cameras[num - 1],
						url: `/livestream/feed/${num}/video.m3u8`
					})),
					lastUpdated: moment().format("h:mm:ss a")
				}))
			}	
		})
	})
}

const attemptRestart = (camera) => {
	request("/livestream/restart", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({camera}),
		mode: "cors"
	})
}

const useLiveVideo = (initialState) => {
	const [state, setState] = useState(initialState)

	useEffect(() => {
		listVideos(state, setState)
	}, [])

	return [state, setState, attemptRestart]
}

export default useLiveVideo