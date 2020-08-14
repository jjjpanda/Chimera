import React from 'react';

import { 
    Button,
    List,
    Card,
    PullToRefresh,
    NoticeBar,
    Icon,
    WingBlank,
    WhiteSpace
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'
import moment from 'moment';
import Processes from './Processes.jsx';
import FileStats from './FileStats.jsx';

class Main extends React.Component {

    render () {
        return (
            <WingBlank>
            
                <WhiteSpace size="md" />
                <Processes />

                <WhiteSpace size="md" />
                <FileStats />

            </WingBlank>
        )
    }
}

export default Main