import React from "react"

import { 
	Card, 
	Carousel, 
} from "antd"

import moment from "moment"
import ReactHlsPlayer from "react-hls-player"
import useLiveVideo from "../hooks/useLiveVideo.js"

const LiveVideo = (props) => {
	const [state, setState] = useLiveVideo({
		loading: false,
		lastUpdated: moment().format("h:mm:ss a"),
		videoList: [],
		cameras: JSON.parse(process.env.cameras)
	})

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