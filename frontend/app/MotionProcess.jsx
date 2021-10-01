import React from 'react';

import { 
    Button,
    List,
    Card,
    Switch,
    ActivityIndicator
} from 'antd-mobile';

import {request, jsonProcessing} from '../js/request.js'
import ProcessCard from './ProcessCard.jsx';

class MotionProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            status: {
                running: false,
                duration: "00:00:00"
            },
            loading: true
        }
    }

    componentDidMount = () => {
        this.status()
    }

    status = () => {
        request("/command/motionStatus", {
            method: "POST"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    status: {
                        running: data.running, 
                        duration: data.duration
                    },
                    loading: false
                }))
            })
        })
    }

    motionChange = (checked) => {
        this.setState({
            status: {
                duration: "00:00:00"
            }, 
            loading: true
        }, () => {
            if(!checked){
                request("/command/motionStop", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status()
                        }, 2500)
                    })
                })
            }
            else{
                request("/command/motionStart", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status()
                        }, 2500)
                    })
                })
            }
        })   
    }

    render() {
        return (
            <ProcessCard 
                title= {"Motion Recording"}
                extra = {<div>
                    <Switch checked = {this.state.status.running} disabled = {this.state.loading} onChange={this.motionChange} />
                </div>}
                body= {<div>
                    Status: {this.state.loading ? <ActivityIndicator /> : (this.state.status.running ? "On": "Off")}
                </div>}
                footer={<div>
                    CPU Time: {this.state.status.duration}
                </div>}
            />
        )
    }
}

export default MotionProcess