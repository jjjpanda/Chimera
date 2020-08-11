import React from 'react';

import { 
    Button,
    List    
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'

class Main extends React.Component {

    constructor(props){
        super(props)
        this.state = {
            videoList: [],
            zipList: []
        }
    }

    componentDidMount = () => {
        this.updateVideos()
        this.updateZips()
    }

    updateVideos = () => {
        request("/listVideo", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            }
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState((oldState) => {
                    return{
                        videoList: Array.from(new Set([...oldState.videoList, ...data.list]))
                    }
                })
            })
        })
    }

    updateZips = () => {
        request("/listZip", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            }
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState((oldState) => {
                    return{
                        zipList: Array.from(new Set([...oldState.zipList, ...data.list]))
                    }
                })
            })
        })
    }

    render () {
        console.log("STATE FROM RENDER", this.state)
        return (
            <List style={{ margin: '5px 0', backgroundColor: 'white' }}>
                {this.state.videoList.map(video => {
                    return (
                        <List.Item
                            extra={<Button type="ghost" size="small" inline>X</Button>}
                            multipleLine
                        >
                            Video
                            <List.Item.Brief>
                                {video.link}
                            </List.Item.Brief>
                        </List.Item>
                    )
                })}

                {this.state.zipList.map(zip => {
                    return (
                        <List.Item
                            extra={<Button type="ghost" size="small" inline>X</Button>}
                            multipleLine
                        >
                            Zip
                            <List.Item.Brief>
                                {zip.link}
                            </List.Item.Brief>
                        </List.Item>
                    )
                })}
                
            </List>
        )
    }
}

export default Main