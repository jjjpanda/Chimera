import {useEffect, useState} from 'react';

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
			const {processList} = data
			if(processList){
				setState((oldState) => ({
					...oldState,
					loading: false,
					videoList: processList.map((cam) => parseInt(cam.name.split("_")[3])).sort((camNumA, camNumB) => {
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

const useLiveVideo = (initialState) => {
    const [state, setState] = useState(initialState)

    useEffect(() => {
		listVideos(state, setState)
	}, [])
}

export default useLiveVideo