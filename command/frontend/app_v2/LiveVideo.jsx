import React, {useState, useEffect} from "react"

import { 
	NoticeBar, 
	Card, 
	Button, 
	Carousel, 
	Tabs,
	Flex,
} from "antd"

import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"
import ReactHlsPlayer from "react-hls-player"

const listVideos = (state, setState) => {
	setState({
		...state,
		loading: true,
		videoList: []
	})
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
				setState({
					...state,
					loading: false,
					videoList: processList.map((cam) => parseInt(cam.name.split("_")[3])).sort((camNumA, camNumB) => {
						return camNumA - camNumB
					}).map((num) => ({
						camera: state.cameras[num - 1],
						url: `/livestream/feed/${num}/video.m3u8`
					})),
					lastUpdated: moment().format("h:mm:ss a")
				})
			}	
		})
	})
}

const LiveVideo = (props) => {
	const [state, setState] = useState({
		loading: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: [],
		cameras: JSON.parse(process.env.cameras)
	})

	useEffect(() => {
		listVideos(state, setState)
	}, [])

	return <Card
		extra={"Live Video"}
		cover={
			<Carousel dotPosition="top">
				{state.videoList.map((video) => {
					return (
						<div>
							<ReactHlsPlayer
								src={video.url}
								autoPlay={false}
								controls={true}
								width="100%"
								height="auto"
							/>
						</div>
					)
				})}
			</Carousel>
		} 
	/>
}

export default LiveVideo