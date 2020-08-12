import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon,
    WhiteSpace,
    Flex,
    Modal
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';
import SaveProcess from './SaveProcess.jsx';

class Processes extends React.Component{

    constructor(props){
        super(props)
        this.state = {
            refreshing: false,
            lastUpdated: moment().format("h:mm:ss a"),
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
        this.motionStatus()
        this.serverStatus()
        this.listProcesses()
        this.setState(() => ({
            lastUpdated: moment().format("h:mm:ss a")
        }))
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
        this.setState({ processList: [] }, () => {
            request("/listProcess", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                }
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.setState(() => {
                        return{
                            processList: [...data.list.sort((process1, process2) => {
                                return moment(process2.start).diff(moment(process1.start), "seconds")
                            })]
                        }
                    })
                })
        })
        })
        
    }

    cancelProcess = (id, type) => {
        request("/cancelProcess", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id
            })
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.listProcesses()
            })
        })
        
    }

    deleteProcess = (id, type) => {
        request("/deleteProcess", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id
            })
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.listProcesses()
            })
        })

    }

    render () {
        console.log("STATE FROM PROCESSES", this.state)
        return (
            <PullToRefresh
                damping={60}
                indicator={{ deactivate: 'Refresh' }}
                direction={'down'}
                refreshing={this.state.refreshing}
                onRefresh={() => {
                    this.setState({ refreshing: true }, () => {
                        this.motionStatus()
                        this.serverStatus()
                        this.listProcesses()
                        this.setState(() => ({
                            lastUpdated: moment().format("h:mm:ss a")
                        }))
                        setTimeout(() => {
                            this.setState({ refreshing: false });
                        }, 1000);
                    });
                }}
            >
                <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                    Last Updated Date: {this.state.lastUpdated}
                </NoticeBar>
                <WhiteSpace size="sm" />

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

                <WhiteSpace size="sm" />

                <Flex>
                    <SaveProcess />
                    <Flex.Item>
                        <a href= "/shared">
                            <Button icon="check-circle-o" >VIEW</Button>
                        </a>
                    </Flex.Item>
                </Flex>

                <WhiteSpace size="sm" />

                {this.state.processList.map(process => {
                    return (
                        <Card >
                            <Card.Header 
                                extra={<Button type="ghost" size="small" inline onClick={() => {
                                    const alert = Modal.alert(process.running ? "Cancel" : "Delete", "Are you sure?", [
                                        { text: "Cancel", onPress: () => {}, style: "default" },
                                        { text: "Ok", onPress: () => {
                                            if(process.running){
                                                this.cancelProcess(process.id)
                                            }
                                            else{
                                                this.deleteProcess(process.id)
                                            }
                                        }}
                                    ])
                                }}>{process.running ? "cancel" : "delete"}</Button>}
                                title={process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
                            />
                                <a href={process.link} download>
                                    LINK
                                </a>
                            <Card.Footer 
                                content={<div>{process.running ? "Running" : "Finished"}</div>} 
                            />  
                        </Card>
                    )
                })}               
            </PullToRefresh>
        )
    }
}

export default Processes