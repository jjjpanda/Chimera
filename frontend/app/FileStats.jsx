import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon,
    InputItem,
    Stepper
} from 'antd-mobile';

import enUs from 'antd-mobile/lib/input-item/locale/en_US';

import {request, jsonProcessing} from './../js/request.js'
import ServerProcess from './ServerProcess.jsx';
import WebDAVProcess from './WebDAVProcess.jsx'
import moment from 'moment';
import alertModal from './Alert.jsx';
import MediaServerProcess from './MediaServerProcess.jsx';

class FileStats extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            loading: true,
            camera: [
                {
                    path: "shared/captures/1",
                    size: 0,
                    count: 0
                },
                {
                    path: "shared/captures/2",
                    size: 0,
                    count: 0
                },
                {
                    path: "shared/captures/3",
                    size: 0,
                    count: 0
                }
            ],
            days: 7,
            lastUpdated: moment().format("h:mm:ss a")
        }
    }

    componentDidMount = () => {
        this.cameraUpdate()
    }

    loadingStatus = (responseNumber, responsesNeeded=this.state.camera.length * (Object.keys(this.state.camera).length - 1)) => {
        if(responseNumber >= responsesNeeded){
            this.setState({
                lastUpdated: moment().format("h:mm:ss a"),
                loading: false
            })
        }
    }

    cameraUpdate = () => {
        let responseNumber = 0
        this.setState({
            loading: true,
            lastUpdated: moment().format("h:mm:ss a")
        }, () => {
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
                        responseNumber++
                        this.setState((oldState) => {
                            oldState.camera[index].size = data.size
                            return oldState
                        }, () => {
                            this.loadingStatus(responseNumber)
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
                        responseNumber++
                        this.setState((oldState) => {
                            oldState.camera[index].count = data.count
                            return oldState
                        }, () => {
                            this.loadingStatus(responseNumber)
                        })
                    })
                })
            })
        })
    }

    deleteFiles = (path=undefined) => {
        if(path != undefined){
            this.setState({
                loading: true
            }, () => {
                request("/pathClean", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        path,
                        days: this.state.days
                    })
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        this.cameraUpdate()
                    })
                })
            })
        }
        else{
            let responseNumber = 0
            this.setState({
                loading: true
            }, () => {
                this.state.camera.forEach((camera) => {
                    request("/pathClean", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            path: camera.path,
                            days: this.state.days
                        })
                    }, (prom) => {
                        jsonProcessing(prom, (data) => {
                            console.log(data)
                            responseNumber++
                            this.loadingStatus(responseNumber, this.state.camera.length)
                        })
                    }) 
                })
            })
        }
    }

    render() {
        console.log("STATE FROM FILE STATS", this.state)
        return (
            <Card>
                <Card.Header
                    title = "Camera Footage" 
                    extra={[
                        <Button style={{width: "50%"}} inline size="small" loading={this.state.loading} disabled={this.state.loading} onClick={this.cameraUpdate}>
                            Refresh{this.state.loading ? "ing" : ""}
                        </Button>,
                        <Button style={{width: "50%"}} inline size="small" loading={this.state.loading} disabled={this.state.loading} onClick={() => {
                            alertModal("Delete", `Deleting files that are ${this.state.days} day old and older.`, () => {
                                this.deleteFiles()
                            })
                        }}>
                            Delet{this.state.loading ? "ing" : "e"}
                        </Button>,
                    ]}
                />
                <Card.Body>
                    <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                        Last Updated Date: {this.state.lastUpdated}
                    </NoticeBar>
                
                    <ServerProcess key={`server${this.state.lastUpdated}`}/>

                    <WebDAVProcess key={`webdav${this.state.lastUpdated}`}/>

                    <MediaServerProcess key={`media${this.state.lastUpdated}`}/>

                    <List >
                        {this.state.camera.map(cam => {
                            return (<List.Item arrow="horizontal" onClick={() => {
                                alertModal(`Delete Files`, `Deleting files that are ${this.state.days} day old and older for ${cam.path}.`, () => {
                                    this.deleteFiles(cam.path)
                                })
                            }} multipleLine>
                                {cam.path} 
                                <List.Item.Brief>Size: {this.state.loading ? "---" : cam.size}</List.Item.Brief>
                                <List.Item.Brief>File Count: {this.state.loading ? "---" : cam.count}</List.Item.Brief>
                            </List.Item>)
                        })}
                        <InputItem 
                            type="money" 
                            moneyKeyboardAlign="right" 
                            value={this.state.days} 
                            onChange={(val) => this.setState(() => ({days: Math.max(Math.round(val), 0)}))}
                            locale={enUs}
                            autoAdjustHeight
                        >
                            Delete Days
                        </InputItem>
                    </List>

                    <a href= "/shared">
                        <Button icon="check-circle-o" >
                            VIEW FILES
                        </Button>
                    </a>

                </Card.Body>
                
            </Card>
        )
    }
}

export default FileStats