import React from 'react';

import { 
    Button,
    List,
    Card,
    Switch,
    ActivityIndicator
} from 'antd-mobile';

import {request, jsonProcessing} from '../js/request.js'

class MotionProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            motionStatus: {
                running: "loading",
                duration: "00:00:00"
            },
        }
    }

    componentDidMount = () => {
        this.motionStatus()
    }

    motionStatus = () => {
        request("/motionStatus", {
            method: "POST"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    motionStatus: {
                        running: data.running, 
                        duration: data.duration
                    }
                }))
            })
        })
    }

    motionChange = (checked) => {
        this.setState({motionStatus: {
                running: "loading",
                duration: "00:00:00"
            }}, () => {
            if(!checked){
                request("/motionStop", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.motionStatus()
                        }, 1000)
                    })
                })
            }
            else{
                request("/motionStart", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.motionStatus()
                        }, 1000)
                    })
                })
            }
        })   
    }

    render() {
        return (
            <Card >
                <Card.Header 
                    extra={<div>
                        <Switch checked = {this.state.motionStatus.running && this.state.motionStatus.running != "loading"} disabled = {this.state.motionStatus.running == "loading"} onChange={this.motionChange} />
                    </div>} 
                />
                Motion: {this.state.motionStatus.running == "loading" ? <ActivityIndicator /> : (this.state.motionStatus.running ? "on": "off")}
                <Card.Footer 
                    content={<div> {this.state.motionStatus.duration} </div>} 
                />
            </Card>
        )
    }
}

export default MotionProcess