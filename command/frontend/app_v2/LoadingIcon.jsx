import React from "react"

const LoadingIcon = (props) => {
	return (
		<div style={{
			width: "25vh",
			height: "25vh",
			position: "fixed",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)"
		}}>
			<img alt="icon" src={"/res/logo.png"} className={"spin"} />
		</div>
	)
}

export default LoadingIcon