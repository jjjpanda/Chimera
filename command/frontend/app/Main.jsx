import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon,
    WingBlank,
    WhiteSpace,
    Tabs
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';
import MotionRecording from './MotionRecording.jsx';
import FileStats from './FileStats.jsx';
import SummaryScrubber from './SummaryScrubber.jsx';
import LiveVideo from './LiveVideo.jsx';

class Main extends React.Component {

    render () {
        return (
            <WingBlank size="sm">
                <Tabs prerenderingSiblingsNumber={0} swipeable={false} animated tabs= {[
                    {title: "Live"},
                    {title: "Motion"},
                    {title: "Scrubber"},
                    {title: "Files"}
                ]}>
                    <LiveVideo />

                    <MotionRecording />

                    <SummaryScrubber />

                    <FileStats />
                </Tabs>
            </WingBlank>
        )
    }
}

export default Main