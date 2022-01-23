import React, { useState, useEffect } from "react"
import useLiveVideo from "../hooks/useLiveVideo.js"
import useSquarifyVideos from "../hooks/useSquarifyVideo.js"

import { Card, Carousel, Row, Col, Space } from "antd"
import ReactHlsPlayer from "react-hls-player"

import moment from "moment"

const LiveVideo = (props) => {
	const [state, setState] = useLiveVideo({
		loading: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: [],
		cameras: JSON.parse(process.env.cameras)
	})

	const [videos, setVideos] = useState([])

	useEffect(() => {
		setVideos(props.grid ? useSquarifyVideos(state.videoList) : state.videoList)
	}, [state.videoList])

	if(props.list){
		return (
			<Space>
				{videos.map((video) => {
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
			</Space>
		)
	}

	if(props.grid){
		return <Space direction="vertical">
			{videos.map(videoRow => {
				return <Row>
					{videoRow.map((video, index, arr) => {
						return <Col span={24/arr.length}>
							<ReactHlsPlayer
								src={video.url}
								autoPlay={false}
								controls={true}
								width="100%"
								height="auto"
							/>
						</Col>
					})}
				</Row>
			})}
		</Space>
	}

	return <Card
		extra={"Live Video"}
		cover={
			<Carousel dotPosition="top">
				{videos.map((video) => {
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