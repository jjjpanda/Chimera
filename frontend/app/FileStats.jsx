import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon,
    ActivityIndicator
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';

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
            numberOfCameras: 3,
        }
    }

    componentDidMount = () => {
        this.cameraUpdate()
    }

    loadingStatus = (responseNumber) => {
        if(responseNumber >= this.state.numberOfCameras * (Object.keys(this.state.camera).length - 1)){
            this.setState({
                loading: false
            })
        }
    }

    cameraUpdate = () => {
        let responseNumber = 0
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
    }

    render() {
        console.log("STATE FROM FILE STATS", this.state)
        return (
            <Card>
                <Card.Header
                    title = "Camera Footage" 
                    extra={<Button size="small" loading={this.state.loading} disabled={this.state.loading} onClick={this.cameraUpdate}>
                            Refresh{this.state.loading ? "ing" : ""}
                    </Button>}
                />
                <Card.Body>
                    <List >
                        {this.state.camera.map(cam => {
                            return (<List.Item arrow="horizontal" multipleLine onClick={() => {}}>
                                {cam.path} 
                                <List.Item.Brief>Size: {this.state.loading == "loading" ? "---" : cam.size}</List.Item.Brief>
                                <List.Item.Brief>File Count: {this.state.loading == "loading" ? "---" : cam.count}</List.Item.Brief>
                            </List.Item>)
                        })}
                    </List>    
                </Card.Body>
                
            </Card>
        )
    }
}

export default FileStats