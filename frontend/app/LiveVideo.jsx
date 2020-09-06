import React from 'react';

import FLVPlayer from './FLVPlayer.jsx';

class LiveVideo extends React.Component{
    render () {
        return (
            <div>
                <div>
                    Camera 1
                    <FLVPlayer 
                        url={`http://localhost:${process.env.mediaPORT}/cam/live_1.flv?sign=${Date.now() + 30000}`} 
                        type="flv" 
                        key={"live_1"}
                        isLive={true} 
                        hasVideo={true} 
                        hasAudio={true} 
                        cors={true}
                    />
                </div>
                <div>
                    Camera 1
                    <FLVPlayer 
                        url={`http://localhost:${process.env.mediaPORT}/cam/live_2.flv?sign=${Date.now() + 30000}`} 
                        type="flv" 
                        key={"live_2"}
                        isLive={true} 
                        hasVideo={true} 
                        hasAudio={true} 
                        cors={true}
                    />
                </div>
                <div>
                    Camera 1
                    <FLVPlayer 
                        url={`http://localhost:${process.env.mediaPORT}/cam/live_3.flv?sign=${Date.now() + 30000}`} 
                        type="flv" 
                        key={"live_3"}
                        isLive={true} 
                        hasVideo={true} 
                        hasAudio={true} 
                        cors={true}
                    />
                </div>
            </div>
        )
    }
}

export default LiveVideo