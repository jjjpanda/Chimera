import React from 'react';

import { 
    Flex,
    Modal, 
    Button,
    SegmentedControl,
    DatePicker,
    List,
    Checkbox,
    WhiteSpace,
    Toast, 
    Card,
    Slider,
    WingBlank
} from 'antd-mobile';

import enUs from 'antd-mobile/lib/date-picker/locale/en_US';

import {request, jsonProcessing, downloadProcessing} from './../js/request.js'
import moment from 'moment';
import CameraDatePicker from './CameraDatePicker.jsx';

class SummaryScrubber extends React.Component{

    constructor(props){
        super(props)
        this.state ={
            sliderIndex: 0,
            camera: 0,
            cameras: ['1', '2', '3'],
            startDate: moment().subtract(1, "day").toDate(),
            endDate: moment().toDate(),
            list: []
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
            frames: 100
        })
        console.log(body)
        return body
    }

    updateImages = () => {
        request("/listFramesVideo", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: this.processBody()
        }, (prom) => {
            
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState({
                    list: data.list
                })
            })
        
        })
    }

    render() {
        return (
            <Card>
                <Card.Header />
                <Card.Body>

                    {this.state.list.map((frame, index) => {
                        return (
                            <img style={{ display: this.state.sliderIndex == index ? "inherit" : 'none'}} src={frame}/>
                        )
                    })}
                    
                    <CameraDatePicker
                        pre ={
                            <List.Item>
                                <br />
                                <WingBlank>
                                    <Slider 
                                        value={this.state.sliderIndex} 
                                        onChange={(val) => {
                                            this.setState({
                                                sliderIndex: val
                                            })
                                        }}
                                    />
                                </WingBlank>
                                <br />
                            </List.Item>
                        }
                        camera={this.state.camera}
                        cameras={this.state.cameras}
                        cameraChange = {(cam) => {
                            this.setState(() => {
                                return {
                                    camera: this.state.cameras.findIndex(camera => camera == cam)
                                }
                            })
                        }}
                        startDate={this.state.startDate}
                        startChange={date => this.setState({ startDate: date })}
                        endDate={this.state.endDate}
                        endChange={date => this.setState({ endDate: date })}
                    />
                </Card.Body>
            </Card>
        )
    }

}

export default SummaryScrubber