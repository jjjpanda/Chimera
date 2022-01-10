import React, { useState, useEffect } from "react"

import {Card, Slider, Progress, Space, Empty, Button, Col, Row } from 'antd'
import { request, jsonProcessing } from "./../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"
import CameraDateNumberPicker from "./CameraDateNumberPicker.jsx"
import { StopFilled, StopOutlined } from "@ant-design/icons"

const processBody = (state) => {
	const body = JSON.stringify({
		camera: (state.camera+1).toString(),
		start: moment(state.startDate).second(0).format("YYYYMMDD-HHmmss"),
		end: moment(state.endDate).second(0).format("YYYYMMDD-HHmmss"),
		frames: state.numberOfFrames
	})
	return body
}

const updateImages = (state, setState) => {
	setState({
		...state,
		list: ["/res/logo.png"],
		loading: true,
		imagesLoaded: 0
	})
	request("/convert/listFramesVideo", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: processBody(state)
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			setState({
				...state,
				list: data.list,
				loading: data.list.length > 0,
				sliderIndex: data.list.length-1
			})
		})
	})
}

const SummaryScrubber = (props) => {
	const [state, setState] = useState({
		sliderIndex: 99,
		numberOfFrames: 100,
		camera: 0,
		cameras: JSON.parse(process.env.cameras),
		startDate: moment().subtract(1, "day"),
		endDate: moment(),
		list: ["/res/logo.png"],
		loading: true,
		imagesLoaded: 0,
	})

	const listHasContents = state.list.length > 0
	const stoppable = state.loading && listHasContents
	const allImagesLoaded = !listHasContents || state.imagesLoaded >= state.list.length

	useEffect(() => {
		updateImages(state, setState)
	}, [state.numberOfFrames, state.camera, state.startDate, state.endDate])

	useEffect(()=> {
		if( allImagesLoaded ){
			setState({
				...state,
				loading: false,
				imagesLoaded: 0
			})
		}
	}, [state.imagesLoaded])

	const onReload = (newState) => {
		setState({
			...state,
			camera: newState.camera,
			startDate: newState.startDate,
			endDate: newState.endDate,
			numberOfFrames: newState.number
		})
	}

	const images = (listHasContents ? state.list.map((frame, index) => {
		return (
			<img 
				style={{ display: state.sliderIndex == index ? "inherit" : "none", objectFit: "contain", height: "100%" }} 
				src={frame}
				onLoad = {() => {
					setState({
						...state,
						imagesLoaded: state.imagesLoaded + 1
					})
				}}
			/>
		)
	}) : <Empty
		description="No Images"
		imageStyle={{display: "inherit"}}
	/>) 

	const progressBar = <Progress 
		percent={Math.round(100 * state.imagesLoaded / state.list.length)}
		status={stoppable ? "active" : "exception"}
	/>

	const selectionSlider = <Slider 
		min={0}
		max={Math.min(state.numberOfFrames - 1, state.list.length - 1)}
		value={state.sliderIndex} 
		onChange={(val) => {
			setState({
				...state,
				sliderIndex: val
			})
		}}
		disabled={state.loading}
	/>

	return (
		<Card cover={images}>
			<Space direction="vertical">
				<Row>
					<Col span={20}>
						{ stoppable ? progressBar : selectionSlider }
					</Col>
					<Col span={2}>
						<Button
							icon={stoppable ? <StopFilled /> : <StopOutlined />}
							onClick={() => {
								setState({
									...state,
									list: ["/res/logo.png"]
								})
							}}
							disabled={!stoppable}
						/>
					</Col>
				</Row>
				<CameraDateNumberPicker
					camera={state.camera}
					cameras={state.cameras}
					startDate={state.startDate}
					endDate={state.endDate}
					number={state.numberOfFrames}
					numberType={"frames"}
					loading={state.loading && state.list.length > 0}
					onChange={onReload}
				/>
			</Space>
		</Card>
	)
}

export default SummaryScrubber