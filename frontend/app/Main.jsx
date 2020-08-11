import React from 'react';

import { 
    Button,
    List,
    Card 
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'

class Main extends React.Component {

    constructor(props){
        super(props)
        this.state = {
            motionStatus: {
                running: false,
                duration: "00:00:00"
            },
            serverStatus: {
                running: true,
                duration: "00:00:00"
            },
            processList: []
        }
    }

    componentDidMount = () => {
        this.listProcesses()
        this.motionStatus()
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

    listProcesses = () => {
        request("/listProcess", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            }
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState((oldState) => {
                    return{
                        processList: Array.from(new Set([...oldState.processList, ...data.list]))
                    }
                })
            })
        })
    }

    render () {
        console.log("STATE FROM RENDER", this.state)
        return (
            <List style={{ margin: '5px 0', backgroundColor: 'white' }}>
                <Card >
                    <Card.Header 
                        extra={<Button type="ghost" size="small" inline>X</Button>} 
                    />
                    Motion: {this.state.motionStatus.running ? "on": "off"}
                    <Card.Footer 
                        content={<div> {this.state.motionStatus.duration} </div>} 
                    />
                </Card>

                <Card>
                    <Card.Header 
                        extra={<Button type="ghost" size="small" inline>X</Button>}
                    />
                    Status: {this.state.serverStatus.running ? "on": "off"}
                    <Card.Footer 
                        content={<div> {this.state.serverStatus.duration} </div>} 
                    />                   
                </Card>
                {this.state.processList.map(process => {
                    return (
                        <Card >
                            <Card.Header 
                                extra={<Button type="ghost" size="small" inline>X</Button>}
                            />
                            {process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
                            <Card.Footer 
                                content={<div>{process.link}</div>} 
                            />  
                        </Card>
                    )
                })}               
            </List>
        )
    }
}

export default Main