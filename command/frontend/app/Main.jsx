import React from 'react';

import { 
    WingBlank,
    Tabs
} from 'antd-mobile';

import MotionRecording from './MotionRecording.jsx';
import FileStats from './FileStats.jsx';
import SummaryScrubber from './SummaryScrubber.jsx';
import LiveVideo from './LiveVideo.jsx';
import { useParams, useNavigate } from 'react-router-dom';

const routeToIndex = (r) => {
    switch(r){
        case "live":
            return 0
        case "motion":
            return 1
        case "scrub":
            return 2
        case "stats":
            return 3
        default: 
            return 0
    }
}

const Main = () => {
    const {route} = useParams()
    const navigate = useNavigate()
    let index = routeToIndex(route)
    return (
        <WingBlank size="sm">
            <Tabs prerenderingSiblingsNumber={0} initialPage={index} swipeable={false} tabBarPosition="bottom" animated tabs= {[
                {title: "Live", routeName:"live"},
                {title: "Motion", routeName:"motion"},
                {title: "Scrubber", routeName:"scrub"},
                {title: "Files", routeName:"stats"}
            ]} onChange={({routeName}) => {
               navigate(`/${routeName}`)
            }}>
                <LiveVideo />

                <MotionRecording />

                <SummaryScrubber />

                <FileStats />
            </Tabs>
        </WingBlank>
    )
}

export default Main