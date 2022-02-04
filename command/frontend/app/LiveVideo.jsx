import React, { useState, useEffect } from "react"
import useLiveVideo from "../hooks/useLiveVideo.js"
import useSquarifyVideos from "../hooks/useSquarifyVideo.js"

import { Card, Tabs, Row, Col, Space, Typography } from "antd"
import ReactHlsPlayer from "react-hls-player"
import NavigateToRoute from "./NavigateToRoute.jsx"

import moment from "moment"

const LiveVideo = (props) => {
	const [state, setState] = useLiveVideo({
		loading: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: [],
		cameras: JSON.parse(process.env.cameras)
	})

	const [videos, setVideos] = useState([])
	const squarify = useSquarifyVideos()

	useEffect(() => {
		setVideos(props.grid ? squarify(state.videoList) : state.videoList)
	}, [state.videoList])

	if(props.list){
		return (
			<Space direction="vertical">
				{videos.map((video) => {
					return <ReactHlsPlayer
						src={video.url}
						autoPlay={false}
						controls={true}
						width="100%"
						height="auto"
					/>
				})}
			</Space>
		)
	}

	if(props.grid){
		return <Space direction="vertical">
			{videos.map(videoRow => {
				return <Row>
					{videoRow.map((video, index, arr) => {
						return video ? <Col span={24/arr.length}>
							<ReactHlsPlayer
								src={video.url}
								autoPlay={false}
								controls={true}
								width="100%"
								height="auto"
							/>
						</Col> : null
					})}
				</Row>
			})}
		</Space>
	}

	return <Card
		title="Live Video"
		size="small"
		extra={<NavigateToRoute to="/live" />}
		cover={<Tabs centered>
			{videos.map((video, index) => <Tabs.TabPane tab={index+1} key={index} style={{textAlign: "center"}}>
				<ReactHlsPlayer
					src={video.url}
					autoPlay={false}
					controls={true}
					width="100%"
					height="auto"
				/>
				<Typography>{video.camera}</Typography>
			</Tabs.TabPane>)}
		</Tabs>}
	/>
}

export default LiveVideo