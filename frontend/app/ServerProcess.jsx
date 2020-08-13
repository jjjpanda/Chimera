import React from 'react';

import { 
    Button,
    List,
    Card,
    Switch,
    ActivityIndicator
} from 'antd-mobile';

import {request, jsonProcessing} from '../js/request.js'

class ServerProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            serverStatus: {
                running: "loading",
                duration: "00:00:00"
            },
        }
    }

    componentDidMount = () => {
        this.serverStatus()
    }

    serverStatus = () => {
        request("/serverStatus", {
            method: "POST"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    serverStatus: {
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
                            this.serverStatus()
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
                            this.serverStatus()
                        }, 1000)
                    })
                })
            }
        })   
    }

    render() {
        return ( 
            <Card>
                <Card.Header 
                    extra={<div>
                        <Button type="ghost" size="small" inline onClick={this.serverUpdate}>Update</Button>
                        <Button size="small" inline onClick={this.serverInstall}>Install</Button>
                    </div>}
                />
                Status: {this.state.serverStatus.running ? "on": "off"}
                <Card.Footer 
                    content={<div> {this.state.serverStatus.duration} </div>} 
                />                   
            </Card>
        )
    }
}

export default ServerProcess