import React from "react"

import {Card, Slider, Progress} from 'antd'
import { request, jsonProcessing } from "./../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"

class SummaryScrubber extends React.Component{

    constructor(props){
		super(props)
		this.state ={
			sliderIndex: 99,
			numberOfFrames: 100,
			camera: 0,
			cameras: JSON.parse(process.env.cameras),
			startDate: moment().subtract(1, "day").toDate(),
			endDate: moment().toDate(),
			list: [],
			loading: true,
			imagesLoaded: 0,
		}
	}

	componentDidMount = () => {
		this.updateImages()
	}

	processBody = () => {
		console.log(this.state.startDate, this.state.endDate)
		const body = JSON.stringify({
			camera: (this.state.camera+1).toString(),
			start: moment(this.state.startDate).second(0).format("YYYYMMDD-HHmmss"),
			end: moment(this.state.endDate).second(0).format("YYYYMMDD-HHmmss"),
			frames: this.state.numberOfFrames
		})
		console.log(body)
		return body
	}

	updateImages = () => {
		this.setState({
			list: [],
			loading: true,
			imagesLoaded: 0
		}, () => {
			request("/convert/listFramesVideo", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: this.processBody()
			}, (prom) => {
                
				jsonProcessing(prom, (data) => {
					console.log(data)
					this.setState({
						list: data.list,
						loading: false
					})
				})
            
			})
		})
        
	}

	sliderPlaythrough = () => {
		const setIterate = () => {
			this.setState((oldState) => {
				return {
					sliderIndex: oldState.sliderIndex+1
				}
			}, () => {
				setTimeout(() => {
					if(this.state.sliderIndex < this.state.numberOfFrames - 1){
						setIterate()
					}
				}, 125)
			})
		}
		console.log("ITERATE")
		setIterate()
	}

    render() {
        const images = (this.state.list.length > 0 ? this.state.list.map((frame, index) => {
            return (
                <img 
                    style={{ display: this.state.sliderIndex == index ? "inherit" : "none"}} 
                    src={frame}
                    onLoad = {() => {
                        
                        this.setState((oldState) => ({
                            imagesLoaded: oldState.imagesLoaded + 1
                        }))
                    }}
                />
            )
        }) : <div>
            No Images
        </div>) 

        const progressBar = <Progress 
            percent={Math.round(100 * this.state.imagesLoaded / this.state.list.length)} 
        />
        const selectionSlider = <Slider 
            min={0}
            max={Math.min(this.state.numberOfFrames - 1, this.state.list.length - 1)}
            value={this.state.sliderIndex} 
            onChange={(val) => {
                this.setState(() => ({
                    sliderIndex: val
                }))
            }}
            disabled={this.state.loading}
        />

        const loadingImages = this.state.list.length > 0 && this.state.imagesLoaded < this.state.list.length

		return (
            <Card 
                cover={!this.state.loading ? images : "Loading"}
            >
                { loadingImages ? progressBar : selectionSlider }
            </Card>
        )
    }
}

export default SummaryScrubber