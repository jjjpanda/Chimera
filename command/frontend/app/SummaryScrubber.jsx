import React from "react"
import usePastImages from "../hooks/usePastImages.js"

import {Card, Slider, Progress, Space, Empty, Button, Col, Row } from "antd"
import { StopFilled, StopOutlined } from "@ant-design/icons"
import CameraDateNumberPicker from "./CameraDateNumberPicker.jsx"
import NavigateToRoute from "./NavigateToRoute.jsx"

const SummaryScrubber = (props) => {
	const [state, setState, listHasContents, stoppable, onReload] = usePastImages(props.numberOfFrames)

	const images = (listHasContents ? state.list.map((frame, index) => (
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
	)) : <Empty
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
		<Card 
			cover={images} 
			size="small" 
			extra={(props.withButton ? <NavigateToRoute to={"/scrub"} /> : null)} 
			title={"Past Images"}
		>
			<Space direction="vertical" style={{width: "100%", textAlign: "center"}}>
				<Row>
					<Col span={21}>
						{ stoppable ? progressBar : selectionSlider }
					</Col>
					<Col span={1}>
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
					disabled={stoppable}
					onChange={onReload}
					mobile={props.mobile}
				/>
			</Space>
		</Card>
	)
}

export default SummaryScrubber