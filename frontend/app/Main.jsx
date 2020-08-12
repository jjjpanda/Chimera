import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';

class Main extends React.Component {

    constructor(props){
        super(props)
        this.state = {
            camera: [
                {
                    path: "shared/captures/1",
                    size: "",
                    count: 0
                },
                {
                    path: "shared/captures/2",
                    size: "",
                    count: 0
                },
                {
                    path: "shared/captures/3",
                    size: "",
                    count: 0
                }
            ],
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
        this.cameraUpdate()
        this.listProcesses()
        this.motionStatus()
        this.serverStatus()
    }

    cameraUpdate = () => {
        this.state.camera.forEach((camera, index) => {
            request("/pathSize", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: camera.path
                })
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.setState((oldState) => {
                        oldState.camera[index].size = data.size
                        return oldState
                    })
                })
            })
            request("/pathFileCount", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: camera.path
                })
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.setState((oldState) => {
                        oldState.camera[index].count = data.count
                        return oldState
                    })
                })
            })
        })
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
            <PullToRefresh
                damping={60}
                ref={el => this.ptr = el}
                style={{
                height: this.state.height,
                overflow: 'auto',
                }}
                indicator={this.state.down ? {} : { deactivate: 'Refresh' }}
                direction={'up'}
                refreshing={this.state.refreshing}
                onRefresh={() => {
                this.setState({ refreshing: true });
                setTimeout(() => {
                    this.setState({ refreshing: false });
                }, 1000);
                }}
            >
                <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                    Last Updated Date: {moment().format()}
                </NoticeBar>

                <List renderHeader={() => 'Subtitle'} className="my-list">
                    {this.state.camera.map(cam => {
                        return (<List.Item arrow="horizontal" multipleLine onClick={() => {}}>
                            {cam.path} 
                            <List.Item.Brief>{cam.size}</List.Item.Brief>
                            <List.Item.Brief>{cam.count}</List.Item.Brief>
                        </List.Item>)
                    })}
                </List>

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
            </PullToRefresh>
        )
    }
}

export default Main