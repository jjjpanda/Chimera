import React, { useState, useEffect } from "react"

import {Card, Slider, Progress, Space, Empty, Button, Col, Row } from 'antd'
import { request, jsonProcessing } from "./../js/request.js"
import moment from "moment"
import Cookies from "js-cookie"
import CameraDateNumberPicker from "./CameraDateNumberPicker.jsx"
import { StopFilled, StopOutlined } from "@ant-design/icons"

import useCamDateNumInfo from "../hooks/useCamDateNumInfo.js"

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

const SummaryScrubber = (props) => {
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

	useEffect(() => {
		setState((oldState) => ({
			...oldState,
			
		}))
	}, [state.loading, state.list])

	const images = (listHasContents ? state.list.map((frame, index) => {
		return (
			<img 
				style={{ display: state.sliderIndex == index ? "inherit" : "none", objectFit: "contain", height: "100%" }} 
				src={frame}
				onLoad = {() => {
					setState((oldState) => ({
						...oldState,
						imagesLoaded: state.imagesLoaded + 1
					}))
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
		max={Math.min(state.number - 1, state.list.length - 1)}
		value={state.sliderIndex} 
		onChange={(val) => {
			setState((oldState) => ({
				...oldState,
				sliderIndex: val
			}))
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
								setState((oldState) => ({
									...oldState,
									list: ["/res/logo.png"]
								}))
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
					number={state.number}
					numberType={state.numberType}
					disabled={state.loading && state.list.length > 0}
					onChange={onReloadGenerator(setState)}
				/>
			</Space>
		</Card>
	)
}

export default SummaryScrubber