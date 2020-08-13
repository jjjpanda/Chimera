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
import MotionProcess from './MotionProcess.jsx';
import ServerProcess from './ServerProcess.jsx';

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