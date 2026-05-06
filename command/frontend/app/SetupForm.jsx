import React, { useState } from "react"
import { Card, Space, Button, Modal, Input } from "antd"
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons"

const SetupForm = ({ trySetup }) => {
	const [modalVisible, setModalVisible] = useState(false)
	const [status, setStatus] = useState(null)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")

	const onSubmit = () => {
		trySetup(username, password, (success) => {
			setStatus(success ? "done" : "failed")
			if (success) setModalVisible(false)
		})
	}

	return (
		<Space>
			<Card
				size="small"
				title="First-time Setup"
				extra={status === null ? <RightCircleOutlined /> : (status === "failed" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
			>
				<Button type="primary" onClick={() => setModalVisible(true)}>
					Setup
				</Button>
			</Card>
			<Modal
				title="First-time Setup"
				visible={modalVisible}
				onOk={onSubmit}
				onCancel={() => setModalVisible(false)}
			>
				<Input
					placeholder="username"
					onChange={e => setUsername(e.target.value)}
					onPressEnter={onSubmit}
					value={username}
					style={{marginBottom: 8}}
				/>
				<Input.Password
					placeholder="password"
					onChange={e => setPassword(e.target.value)}
					onPressEnter={onSubmit}
					value={password}
				/>
			</Modal>
		</Space>
	)
}

export default SetupForm
