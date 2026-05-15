import React from "react"
import useLoginSchema from "../hooks/useLoginSchema"

import { Card, Space, Button, Modal, Input } from "antd"
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons"

const LoginForm = (props) => {
	const [loginStatus, modalVisible, toggleModal, inputValues, onLoginEnter, updateUsername, updatePassword] = useLoginSchema(props)

	return (
		<Space>
			<Card
				size="small"
				title="Login"
				extra={loginStatus == null ? <RightCircleOutlined /> : (loginStatus == "wrong" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
			>
				<Button type="primary" onClick={() => toggleModal(true)}>
                    Login
				</Button>
			</Card>
			<Modal
				title="Login"
				visible={modalVisible}
				onOk={onLoginEnter}
				onCancel={() => toggleModal(false)}
			>
				<Input
					placeholder="username"
					onChange={updateUsername}
					onPressEnter={onLoginEnter}
					value={inputValues.username}
					style={{marginBottom: 8}}
				/>
				<Input.Password
					placeholder="password"
					onChange={updatePassword}
					onPressEnter={onLoginEnter}
					value={inputValues.password}
				/>
			</Modal>
		</Space>
	)
}

export default LoginForm
