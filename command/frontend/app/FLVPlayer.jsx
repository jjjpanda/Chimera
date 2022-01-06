import React from "react"
import flvjs from "flv.js"

import{
	Card, Button
} from "antd-mobile"

/**
 * @deprecated
 */
class FLVPlayer extends React.Component{
	initFlv = (video) => {
		if (video) {
			if (flvjs.isSupported()) {
				let flvPlayer = flvjs.createPlayer({ ...this.props }, this.props.config)
				flvPlayer.attachMediaElement(video)
				this.flvPlayer = flvPlayer
				this.flvPlayer.load()

				setInterval(() => {
					if (!video.buffered.length) {
						return
					}
					let end = video.buffered.end(0)
					let timeDifference = end - video.currentTime
    
					if (timeDifference >= 1.125){
						video.currentTime = end
					}
				}, 60000)
                
				this.flvPlayer.play()
			}
		}
	}

	componentDidMount = () =>  {
	}

	componentWillUnmount = () => {
		if (this.flvPlayer) {
			this.flvPlayer.unload()
			this.flvPlayer.detachMediaElement()
			this.flvPlayer.destroy()
		}
	}

	render() {
		return (
			<Card>
				<Card.Header
					title={`Camera ${this.props.camera}`}
					extra={<div>
					</div>}
				/>
				<Card.Body>
					<video
						muted
						autoPlay
						controls
						id={this.props.key}
						ref={this.initFlv}
					/>
				</Card.Body>
				<Card.Footer extra={<Button size="small">

				</Button>}>
				</Card.Footer>
			</Card>
		)
	}
}

export default FLVPlayer