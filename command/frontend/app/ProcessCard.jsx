import React from "react"

import {
	Card,
} from "antd-mobile"

/**
 * @deprecated
 */
const ProcessCard = (props) => (
	<Card >
		<Card.Header 
			title={props.title} 
			extra={props.extra} 
		/>
		<Card.Body>
			{props.body}
		</Card.Body>
		<Card.Footer 
			content={props.footer} 
		/>
	</Card>
)

export default ProcessCard