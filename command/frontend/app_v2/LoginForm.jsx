import React from "react"
import { Card, Space, Button, Modal, message, Input, InputNumber } from 'antd'
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

class LoginForm extends React.Component{
    constructor(props){
		super(props)
		this.state = {
			loginStatus: null,
            isPasswordModalVisible: false,
            isPINModalVisible: false,
            pin: "",
            password: ""
		}
	}

	statusHandler = (err) => {
		this.setState(() => ({
			loginStatus: !err ? "right" : "wrong"
		}))
	}

	onPasswordEnter = () => {
        const {password} = this.state
		this.props.loginReq(password).then(req => this.props.handler(req, this.props.timestamp, this.statusHandler))
        this.toggleModal(false, "Password")()
	}

    onPINEnter = () => {
        const {pin} = this.state
		this.props.loginReq(pin, "/authorization/requestLink", {pin}).then(({error}) => {
			this.setState(() => ({
				loginStatus: !error ? "right" : "wrong"
			}), () => {
				if(!error){
					message.success("Request for temporary link was successful.\nCheck your messages!", 20)
				}
				else{
					message.error("Request for temporary link failed.", 4)
				}
                this.toggleModal(false, "PIN")()
			})
		})
	}

    componentDidMount() {
		const {passwordAttempt} = this.props
		if(passwordAttempt != undefined){
			this.props.loginReq(passwordAttempt).then(res => {
				this.props.handler(res, this.props.timestamp, this.statusHandler)
			})
		}
	}

    toggleModal = (show, type) => () => {
        this.setState(() => ({[`is${type}ModalVisible`]: show}))
    }

    updateValue = (type) => (e) => {
        const {value} = e.target;
        this.setState(() => ({[type]: value}))
    }

    render() {
		return (
            <Space>
                <Card
                    title="Login"
                    extra={this.state.loginStatus == null ? <RightCircleOutlined /> : (this.state.loginStatus == "wrong" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
                >
                    <Button type="primary" onClick={this.toggleModal(true, "Password")}>
                        Password
                    </Button>
                    <Button onClick={this.toggleModal(true, "PIN")}>
                        PIN
                    </Button>
                </Card>
                <Modal title="Password" visible={this.state.isPasswordModalVisible} onOk={this.onPasswordEnter} onCancel={this.toggleModal(false, "Password")}>
                    <Input.Password 
                        placeholder="input password" 
                        onChange={this.updateValue('password')} 
                        onPressEnter={this.onPasswordEnter}
                        value={this.state.password}
                    />
                </Modal>
                <Modal title="PIN" visible={this.state.isPINModalVisible} onOk={this.onPINEnter} onCancel={this.toggleModal(false, "PIN")}>
                    <Input.Password 
                        placeholder="input pin" 
                        onChange={this.updateValue('pin')} 
                        onPressEnter={this.onPINEnter}
                        value={this.state.pin}
                    />
                </Modal>
            </Space>
        )
    }
}

export default LoginForm