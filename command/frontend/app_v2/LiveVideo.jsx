import React from "react"

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

class LiveVideo extends React.Component{
    constructor(props){
		super(props)
		this.state = {
			loading: false,
			lastUpdated: moment().format("h:mm:ss a"),
			videoList: [],
			cameras: JSON.parse(process.env.cameras)
		}
	}

	componentDidMount = () => {
		this.listVideos()
	}

	listVideos = () => {
		this.setState({
			loading: true,
			videoList: []
		}, () => {
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
						this.setState({
							loading: false,
							videoList: processList.map((cam) => parseInt(cam.name.split("_")[3])).sort((camNumA, camNumB) => {
								return camNumA - camNumB
							}).map((num) => ({
								camera: this.state.cameras[num - 1],
								url: `/livestream/feed/${num}/video.m3u8`
							})),
							lastUpdated: moment().format("h:mm:ss a")
						})
					}
                    
				})
			})
		})
	}

    render () {
		return (
			<Card
                cover={
                    <Carousel dotPosition="top">
                        {this.state.videoList.map((video) => {
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
            >
                <Card.Meta 
                    description="Live Video"
                />
			</Card>
		)
	}

}

export default LiveVideo