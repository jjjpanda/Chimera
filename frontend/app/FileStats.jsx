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

class FileStats extends React.Component {
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
            ]
        }
    }

    componentDidMount = () => {
        this.cameraUpdate()
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

    render() {
        console.log("STATE FROM FILE STATS", this.state)
        return (
            <List renderHeader={() => 'Subtitle'} className="my-list">
                {this.state.camera.map(cam => {
                    return (<List.Item arrow="horizontal" multipleLine onClick={() => {}}>
                        {cam.path} 
                        <List.Item.Brief>{cam.size}</List.Item.Brief>
                        <List.Item.Brief>{cam.count}</List.Item.Brief>
                    </List.Item>)
                })}
            </List>
        )
    }
}

export default FileStats