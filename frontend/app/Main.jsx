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
import Processes from './Processes.jsx';
import FileStats from './FileStats.jsx';
import SummaryScrubber from './SummaryScrubber.jsx';

class Main extends React.Component {

    render () {
        return (
            <WingBlank>
                <Tabs prerenderingSiblingsNumber={0} swipeable={false} animated tabs= {[
                    {title: "Processes"},
                    {title: "Image Preview"},
                    {title: "File Stats"}
                ]}>
                    <Processes />

                    <SummaryScrubber />

                    <FileStats />
                </Tabs>
            </WingBlank>
        )
    }
}

export default Main