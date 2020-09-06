import React from 'react';
import flvjs from 'flv.js';

class FLVPlayer extends React.Component{
    initFlv = (video) => {
        if (video) {
            if (flvjs.isSupported()) {
                let flvPlayer = flvjs.createPlayer({ ...this.props }, this.props.config);
                flvPlayer.attachMediaElement(video);
                flvPlayer.load();
                flvPlayer.play();
                this.flvPlayer = flvPlayer;
            }
        }
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
                controls
                id={this.props.key}
                ref={this.initFlv}
            />
        )
    }
}

export default FLVPlayer