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

import {
    LineChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Line,
    ResponsiveContainer
} from 'recharts'

import { formatBytes } from 'lib'

import enUs from 'antd-mobile/lib/input-item/locale/en_US';

import {request, jsonProcessing} from './../js/request.js'
import ServerProcess from './ServerProcess.jsx';
import WebDAVProcess from './WebDAVProcess.jsx'
import moment from 'moment';
import alertModal from './Alert.jsx';
import Cookies from 'js-cookie';

const colorArray = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6', 
		  '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
		  '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
		  '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
		  '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
		  '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
		  '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680', 
		  '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
		  '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3', 
		  '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'];

class FileStats extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            loading: "refreshing",
            camera: JSON.parse(process.env.cameras).map((element, index) => {
                return {
                    path: `shared/captures/${index + 1}`,
                    index: index+1,
                    size: 0,
                    count: 0
                }
            }),
            days: 7,
            lastUpdated: moment().format("h:mm:ss a"),
            countStats: [],
            sizeStats: []
        }
    }

    componentDidMount = () => {
        this.cameraUpdate()
        this.statsUpdate()
    }

    doneLoading = () => {
        this.setState(() => ({
            lastUpdated: moment().format("h:mm:ss a"),
            loading: undefined
        }))
    }

    statsUpdate = () => {
        request('/file/pathStats', {
            method: "GET"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                if(data != undefined && "count" in data && "size" in data){
                    this.setState(() => ({
                        countStats: data.count,
                        sizeStats: data.size
                    }))
                }
            })
        })
    }

    cameraUpdate = () => {
        this.setState({
            loading: "refreshing",
            lastUpdated: moment().format("h:mm:ss a")
        }, () => {
            Promise.all([].concat(
                new Promise(resolve => this.state.camera.map((camera, index) => {
                    request("/file/pathSize", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            camera: camera.index
                        })
                    }, (prom) => {
                        jsonProcessing(prom, (data) => {
                            this.setState((oldState) => {
                                oldState.camera[index].size = data && data.size ? data.size : "-"
                                return oldState
                            }, resolve)
                        })
                    })
                })),
                this.state.camera.map((camera, index) => {
                    new Promise(resolve => request("/file/pathFileCount", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            camera: camera.index
                        })
                    }, (prom) => {
                        jsonProcessing(prom, (data) => {
                            this.setState((oldState) => {
                                oldState.camera[index].count = data && data.count ? data.count : "-"
                                return oldState
                            }, resolve)
                        })
                    }))
                })
            )).then(this.doneLoading)
        })
    }

    deleteFiles = (camera=undefined) => {
        if(camera != undefined){
            this.setState({
                loading: "deleting"
            }, () => {
                request("/file/pathClean", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        camera,
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
            this.setState({
                loading: "deleting"
            }, () => {
                Promise.all(this.state.camera.map((camera) => {
                    request("/file/pathClean", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            camera: camera.index,
                            days: this.state.days
                        })
                    }, (prom) => {
                        jsonProcessing(prom, (data) => {
                            console.log(data)
                            resolve()
                        })
                    }) 
                })).then(this.doneLoading)
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
                        <Button style={{width: "50%"}} inline size="small" loading={this.state.loading == "refreshing"} disabled={this.state.loading} onClick={this.cameraUpdate}>
                            Refresh{this.state.loading == "refreshing" ? "ing" : ""}
                        </Button>,
                        <Button style={{width: "50%"}} inline size="small" loading={this.state.loading == "deleting"} disabled={this.state.loading} onClick={() => {
                            alertModal("Delete", `Deleting files that are ${this.state.days} day old and older.`, () => {
                                this.deleteFiles()
                            })
                        }}>
                            Delet{this.state.loading == "deleting" ? "ing" : "e"}
                        </Button>,
                    ]}
                />
                <Card.Body>
                    <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                        Last Updated Date: {this.state.lastUpdated}
                    </NoticeBar>
                
                    {/* <ServerProcess key={`server${this.state.lastUpdated}`}/> */}

                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart width={730} height={250} data={this.state.countStats}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" type="number" tickFormatter={timeStr => moment(timeStr, "x").format('MM/DD HH:mm')} domain={['auto', 'auto']} hide/>
                            <YAxis />
                            <Legend />
                            <Tooltip />
                            {JSON.parse(process.env.cameras).map((name, index) => {
                                return <Line type="monotone" dataKey={name} stroke={colorArray[index]} />
                            })}
                        </LineChart>
                    </ResponsiveContainer>

                    <br />
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart width={730} height={250} data={this.state.sizeStats}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="timestamp" type="number" tickFormatter={timeStr => moment(timeStr, "x").format('MM/DD HH:mm')} domain={['auto', 'auto']} hide/>
                            <YAxis tickFormatter={val => formatBytes(val)}/>
                            <Legend />
                            <Tooltip />
                            {JSON.parse(process.env.cameras).map((name, index) => {
                                return <Line type="monotone" dataKey={name} stroke={colorArray[index]} />
                            })}
                        </LineChart>
                    </ResponsiveContainer>

                    <List >
                        {this.state.camera.map(cam => {
                            return (<List.Item arrow="horizontal" onClick={() => {
                                alertModal(`Delete Files`, `Deleting files that are ${this.state.days} day old and older for ${cam.path}.`, () => {
                                    this.deleteFiles(cam.index)
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