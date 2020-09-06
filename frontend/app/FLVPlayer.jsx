import React from 'react';
import flvjs from 'flv.js';

class FLVPlayer extends React.Component{
    initFlv = (video) => {
        if (video) {
            if (flvjs.isSupported()) {
                let flvPlayer = flvjs.createPlayer({ ...this.props }, this.props.config);
                flvPlayer.attachMediaElement(video);
                this.flvPlayer = flvPlayer;
                this.flvPlayer.load();
                
                this.flvPlayer.play();
            }
        }
    }

    componentDidMount = () =>  {
    }

    componentWillUnmount = () => {
        if (this.flvPlayer) {
            this.flvPlayer.unload();
            this.flvPlayer.detachMediaElement();
            this.flvPlayer.destroy();
        }
    }

    render() {
        return (
            <video
                muted
                autoPlay
                id={this.props.key}
                ref={this.initFlv}
            />
        )
    }
}

export default FLVPlayer