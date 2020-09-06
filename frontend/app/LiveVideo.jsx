import React from 'react';

import { 
    NoticeBar, 
    Card, 
    Button, 
    WingBlank,
    Icon 
} from 'antd-mobile';

import FLVPlayer from './FLVPlayer.jsx';
import MediaServerProcess from './MediaServerProcess.jsx'
import moment from 'moment'
import { request, jsonProcessing } from '../js/request.js';

class LiveVideo extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            loading: false,
            lastUpdated: moment().format("h:mm:ss a"),
            videoList: []
        }
    }

    componentDidMount = () => {
        this.listVideos();
    }

    listVideos = () => {
        this.setState({
            loading: true,
            videoList: []
        }, () => {
            request(`http://localhost:${process.env.mediaPORT}/api/streams`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors'
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.setState({
                        loading: false,
                        videoList: data != undefined ? Object.values(data.cam).map((camera, index)=> {
                            return {
                                camera: index + 1,
                                url: `http://localhost:${process.env.mediaPORT}/${camera.publisher.app}/${camera.publisher.stream}.flv`
                            }
                        }) : [],
                        lastUpdated: moment().format("h:mm:ss a")
                    })
                })
            })
        })
    }

    render () {
        return (
            <Card>
                <Card.Header 
                    title= "Live Video"
                    extra={<Button size="small" loading={this.state.loading} disabled={this.state.loading} onClick={this.listVideos}>
                        Refresh{this.state.loading ? "ing" : ""}
                    </Button>}
                />
                <Card.Body>
                    <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                        Last Updated Date: {this.state.lastUpdated}
                    </NoticeBar>

                    <MediaServerProcess key={`media${this.state.lastUpdated}`}/>

                    {this.state.videoList.map((video) => {
                        return (
                            <Card>
                                <Card.Header>

                                </Card.Header>
                                <Card.Body>
                                    Camera {video.camera}
                                    <FLVPlayer 
                                        url={video.url} 
                                        type="flv" 
                                        key={`live_${video.camera}_${this.state.lastUpdated}`}
                                        isLive={true} 
                                        hasVideo={true} 
                                        hasAudio={true} 
                                        cors={true}
                                    />
                                </Card.Body>
                            </Card>
                        )
                    })}
                </Card.Body>
                

            </Card>
        )
    }
}

export default LiveVideo