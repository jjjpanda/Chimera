import React from "react"
import useLoginSchema from "../hooks/useLoginSchema"

import { Card, Space, Button, Modal, Input } from "antd"
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons"

const LoginForm = (props) => {
	const [loginStatus, modalVisible, toggleModal, inputValues, onPasswordEnter, onPINEnter, updatePassword, updatePIN] = useLoginSchema(props)

	return (
		<Space>
			<Card
				title="Login"
				extra={loginStatus == null ? <RightCircleOutlined /> : (loginStatus == "wrong" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
			>
				<Button type="primary" onClick={() => toggleModal(true, "password")}>
                    Password
				</Button>
				<Button onClick={() => toggleModal(true, "pin")}>
                    PIN
				</Button>
			</Card>
			<Modal
				title="Password" 
				visible={modalVisible.password}
				onOk={onPasswordEnter}
				onCancel={() => toggleModal(false, "password")}
			>
				<Input.Password 
					placeholder="input password" 
					onChange={updatePassword} 
					onPressEnter={onPasswordEnter}
					value={inputValues.password}
				/>
			</Modal>
			<Modal
				title="PIN"
				visible={modalVisible.pin}
				onOk={onPINEnter}
				onCancel={() => toggleModal(false, "pin")}
			>
				<Input.Password 
					placeholder="input pin" 
					onChange={updatePIN} 
					onPressEnter={onPINEnter}
					value={inputValues.pin}
				/>
			</Modal>
		</Space>
	)
}

export default LoginForm