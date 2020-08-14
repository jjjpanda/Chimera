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
    Modal,
    WingBlank
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';
import SaveProcess from './SaveProcess.jsx';
import MotionProcess from './MotionProcess.jsx';
import ServerProcess from './ServerProcess.jsx';
import alertModal from './Alert.jsx';

class Processes extends React.Component{

    constructor(props){
        super(props)
        this.state = {
            refreshing: false,
            lastUpdated: moment().format("h:mm:ss a"),
            processList: []
        }
    }

    componentDidMount = () => {
        this.listProcesses()
        this.setState(() => ({
            lastUpdated: moment().format("h:mm:ss a")
        }))
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
                setTimeout(() => {
                    this.listProcesses()  
                }, 1500)
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
                setTimeout(() => {
                    this.listProcesses()  
                }, 1500)
            })
        })

    }

    render () {
        console.log("STATE FROM PROCESSES", this.state)
        return (
            <PullToRefresh
                damping={60}
                indicator={{ activate: "Refresh", deactivate: "Cancel", release: "Refreshing", finish: "Refreshed" }}
                direction={'down'}
                refreshing={this.state.refreshing}
                onRefresh={() => {
                    this.setState({ refreshing: true }, () => {
                        this.componentDidMount()
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

                <MotionProcess key={`motion${this.state.lastUpdated}`}/>
                <ServerProcess key={`server${this.state.lastUpdated}`}/>

                <WhiteSpace size="sm" />

                <Flex>
                    <SaveProcess update={this.listProcesses}/>
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
                                extra={<div>
                                    {process.running ? null : <a href={process.link} download>
                                        <Button size="small" inline>
                                            Download
                                        </Button>
                                    </a>}
                                    <Button type="ghost" size="small" inline onClick={() => {
                                        alertModal(process.running ? "Cancel" : "Delete", "Are you sure?", () => {
                                            if(process.running){
                                                this.cancelProcess(process.id)
                                            }
                                            else{
                                                this.deleteProcess(process.id)
                                            }
                                        })
                                    }}>{process.running ? "Cancel" : "Delete"}</Button>
                                </div>
                                }
                                title={process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
                            />
                                <WingBlank size="md">
                                    Camera: {process.camera} <br />
                                    Start: {moment(process.start, "YYYYMMDD-HHmmss").format("LLL")} <br />
                                    End: {moment(process.end, "YYYYMMDD-HHmmss").format("LLL")} <br />
                                    {(process.running || process.type != "mp4") ? null : <video src={process.link} type="video/mp4" controls/>}
                                </WingBlank>
                                <br />
                            <Card.Footer 
                                content={<div>{process.running ? "Running" : null}</div>} 
                            />  
                        </Card>
                    )
                })}               
            </PullToRefresh>
        )
    }
}

export default Processes