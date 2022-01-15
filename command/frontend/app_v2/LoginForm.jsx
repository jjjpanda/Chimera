import React, {useState, useEffect} from "react"
import { Card, Space, Button, Modal, message, Input, InputNumber } from 'antd'
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

const statusHandler = (err, state, setState) => {
    console.log(err, state, setState)
    setState({
        ...state,
        loginStatus: !err ? "right" : "wrong"
    })
}

const onPasswordEnter = (props, state, setState) => () => {
    console.log(props, state, setState)
    const {password} = state
    props.loginReq(password).then(req => props.handler(req, props.timestamp, statusHandler))
    toggleModalGenerator(false, "Password", state, setState)()
}

const onPINEnter = (props, state, setState) => () => {
    console.log(props, state, setState)
    const {pin} = state
    props.loginReq(pin, "/authorization/requestLink", {pin}).then(({error}) => {
        setState({
            ...state,
            loginStatus: !error ? "right" : "wrong"
        })
        if(!error){
            message.success("Request for temporary link was successful.\nCheck your messages!", 20)
        }
        else{
            message.error("Request for temporary link failed.", 4)
        }
        toggleModalGenerator(false, "PIN", state, setState)()
    })
}

const toggleModalGenerator = (show, type, state, setState) => () => {
    console.log(type, state, setState)
    setState({
        ...state,
        [`is${type}ModalVisible`]: show
    })
}

const updateValueGenerator = (type, state, setState) => (e) => {
    console.log(type, state, setState)
    const {value} = e.target;
    setState({
        ...state,
        [type]: value
    })
}

const LoginForm = (props) => {
    const [state, setState] = useState({
        loginStatus: null,
        isPasswordModalVisible: false,
        isPINModalVisible: false,
        pin: "",
        password: ""
    })

    useEffect(() => {
        const {passwordAttempt} = props
		if(passwordAttempt != undefined){
			props.loginReq(passwordAttempt).then(res => {
				props.handler(res, props.timestamp, statusHandler)
			})
		}
    }, [])

    return (
        <Space>
            <Card
                title="Login"
                extra={state.loginStatus == null ? <RightCircleOutlined /> : (state.loginStatus == "wrong" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
            >
                <Button type="primary" onClick={toggleModalGenerator(true, "Password", state, setState)}>
                    Password
                </Button>
                <Button onClick={toggleModalGenerator(true, "PIN", state, setState)}>
                    PIN
                </Button>
            </Card>
            <Modal title="Password" visible={state.isPasswordModalVisible} onOk={onPasswordEnter(props, state, setState)} onCancel={toggleModalGenerator(false, "Password", state, setState)}>
                <Input.Password 
                    placeholder="input password" 
                    onChange={updateValueGenerator('password', state, setState)} 
                    onPressEnter={onPasswordEnter(props, state, setState)}
                    value={state.password}
                />
            </Modal>
            <Modal title="PIN" visible={state.isPINModalVisible} onOk={onPINEnter(props, state, setState)} onCancel={toggleModalGenerator(false, "PIN", state, setState)}>
                <Input.Password 
                    placeholder="input pin" 
                    onChange={updateValueGenerator('pin', state, setState)} 
                    onPressEnter={onPINEnter(props, state, setState)}
                    value={state.pin}
                />
            </Modal>
        </Space>
    )
}

export default LoginForm