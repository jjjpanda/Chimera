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

class MediaServerProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            status: {
                running: false,
                recording: false,
            },
            loading: true
        }
    }

    componentDidMount = () => {
        this.status()
    }

    status = (callback=()=>{}) => {
        request("/mediaStatus", {
            method: "POST"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    status: {
                        running: data.running,
                        recording: data.recording
                    },
                    loading: false
                }), callback)
            })
        })
    }

    change = (checked, record=this.state.status.recording, callback=()=>{}) => {
        this.setState({
            loading: true
        }, () => {
            if(!checked){
                request("/mediaOff", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status(callback)
                        }, 1000)
                    })
                })
            }
            else{
                request("/mediaOn", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        record: record
                    })
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status(callback)
                        }, 1000)
                    })
                })
            }
        })   
    }

    recordingChange= (checked) => {
        this.change(false, false, ()=> {
            this.change(true, checked)
        })
    }

    render() {
        return (
            <ProcessCard 
                title= {"Media Process Server"}
                extra = {<div>
                    <Switch checked = {this.state.status.running} disabled = {this.state.loading} onChange={this.change} />
                </div>}
                body= {<div>
                    Status: {this.state.loading ? <ActivityIndicator /> : (this.state.status.running ? "On": "Off")}
                </div>}
                footer={<div>
                    Recording: {this.state.loading ? "---" : (this.state.status.recording ? "On": "Off")}
                    <br />
                    <Switch checked = {this.state.status.recording} disabled = {this.state.loading} onChange={this.recordingChange} />
                </div>}
            />
        )
    }
}

export default MediaServerProcess