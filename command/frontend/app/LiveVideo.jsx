import React from 'react';

import { 
    NoticeBar, 
    Card, 
    Button, 
    WingBlank,
    Icon, 
    Tabs,
    Flex,
} from 'antd-mobile';

import FLVPlayer from './FLVPlayer.jsx';
import MediaServerProcess from './MediaServerProcess.jsx'
import moment from 'moment'
import { request, jsonProcessing } from '../js/request.js';
import ReactHlsPlayer from 'react-hls-player';

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
            /* request(`http://${process.env.mediaHost}:${process.env.mediaPORT}/api/streams`, {
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
                        videoList: data != undefined ? Object.entries(data.cam).sort((a, b) => { return a[0].localeCompare(b[0])}).map((v) => v[1]).map((camera, index)=> {
                            return {
                                camera: index + 1,
                                url: `http://${process.env.mediaHost}:${process.env.mediaPORT}/${camera.publisher.app}/${camera.publisher.stream}.flv`
                            }
                        }) : [],
                        lastUpdated: moment().format("h:mm:ss a")
                    })
                })
            }) */
        })
    }

    render () {
        /* return (
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

                    <Tabs prerenderingSiblingsNumber={2} swipeable={true} animated tabs= {this.state.videoList.map(video => {
                        return {title: video.camera}
                    })}>
                        {this.state.videoList.map((video) => {
                            return (
                                <FLVPlayer 
                                    camera={video.camera}
                                    url={video.url} 
                                    type="flv" 
                                    config={{
                                        enableStashBuffer: false
                                    }}
                                    key={`live_${video.camera}_${this.state.lastUpdated}`}
                                    isLive={true} 
                                    hasVideo={true} 
                                    hasAudio={true} 
                                    cors={true}
                                />
                            )
                        })} 
                    </Tabs>
                </Card.Body>
                

            </Card>
        ) */
        /* return JSON.parse(process.env.cameras).map((i) => (<ReactHlsPlayer
            src={`/shared/captures/live/${i}/video.m3u8`}
            autoPlay={false}
            controls={true}
            width="auto"
            height="50%"
        />)) */
        return (
        <>
            <Flex>
                <Flex.Item>
                    <ReactHlsPlayer
                        src={`/livestream/feed/1/video.m3u8`}
                        autoPlay={false}
                        controls={true}
                        width="auto"
                        height="40%"
                    />
                </Flex.Item>
                <Flex.Item>
                    <ReactHlsPlayer
                        src={`/livestream/feed/2/video.m3u8`}
                        autoPlay={false}
                        controls={true}
                        width="auto"
                        height="40%"
                    />
                </Flex.Item>
            </Flex>
            <Flex>
                <Flex.Item>
                    <ReactHlsPlayer
                        src={`/livestream/feed/3/video.m3u8`}
                        autoPlay={false}
                        controls={true}
                        width="auto"
                        height="40%"
                    />
                </Flex.Item>
                <Flex.Item>
                    <ReactHlsPlayer
                        src={`/livestream/feed/4/video.m3u8`}
                        autoPlay={false}
                        controls={true}
                        width="auto"
                        height="40%"
                    />
                </Flex.Item>
            </Flex>
        </>
        )
    }
}

export default LiveVideo