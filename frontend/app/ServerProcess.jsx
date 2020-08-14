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
            updatingOrInstalling: false,
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

    serverUpdate = () => {
        this.setState({motionStatus: {
                running: "loading",
                duration: "00:00:00"
            }, updatingOrInstalling: true}, () => {
            request("/serverUpdate", {
                method: "POST"
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    setTimeout(() => {
                        this.setState({updatingOrInstalling: false})
                        this.serverStatus()
                    }, 1000)
                })
            })
        })   
    }

    serverInstall = () => {
        this.setState({motionStatus: {
                running: "loading",
                duration: "00:00:00"
            }, updatingOrInstalling: true}, () => {
            request("/serverInstall", {
                method: "POST"
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    setTimeout(() => {
                        this.setState({updatingOrInstalling: false})
                        this.serverStatus()
                    }, 1000)
                })
            })
        })   
    }

    render() {
        return ( 
            <Card>
                <Card.Header 
                    extra={(this.state.updatingOrInstalling ? <ActivityIndicator />: <div>
                        <Button type="ghost" size="small" inline onClick={this.serverUpdate}>Update</Button>
                        <Button size="small" inline onClick={this.serverInstall}>Install</Button>
                    </div>)}
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