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
            videoList: [],
            cameras: JSON.parse(process.env.cameras)
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
            request(`/livestream/status`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors'
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    const {processList} = data
                    if(processList){
                        this.setState({
                            loading: false,
                            videoList: processList.map((cam) => parseInt(cam.name.split("_")[3])).sort((camNumA, camNumB) => {
                                return camNumA - camNumB
                            }).map((num) => ({
                                camera: this.state.cameras[num - 1],
                                url: `/livestream/feed/${num}/video.m3u8`
                            })),
                            lastUpdated: moment().format("h:mm:ss a")
                        })
                    }
                    
                })
            })
        })
    }

    render () {
        return (
            <Card>
                <NoticeBar mode="closable" icon={<Icon type="check-circle-o" size="xxs" />}>
                    Last Updated Date: {this.state.lastUpdated}
                </NoticeBar>
                <Card.Header 
                    title= "Live Video"
                    extra={<Button size="small" loading={this.state.loading} disabled={this.state.loading} onClick={this.listVideos}>
                        Refresh{this.state.loading ? "ing" : ""}
                    </Button>}
                />
                <Card.Body>
                
                    {/* <MediaServerProcess key={`media${this.state.lastUpdated}`}/> */}

                    <Tabs prerenderingSiblingsNumber={2} swipeable={true} animated tabs= {this.state.videoList.map(video => {
                        return {title: video.camera}
                    })}>
                        {this.state.videoList.map((video) => {
                            return (
                                <ReactHlsPlayer
                                    src={video.url}
                                    autoPlay={false}
                                    controls={true}
                                    width="100%"
                                    height="auto"
                                />
                            )
                        })} 
                    </Tabs>
                </Card.Body>
                

            </Card>
        )
    }
}

export default LiveVideo