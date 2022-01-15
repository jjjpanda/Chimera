import React, {useState, useEffect} from "react"
import { Card, Space, Button, Modal, message, Input, InputNumber } from 'antd'
import { RightCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

const toggleModalGenerator = (show, type, toggleModal) => () => {
    toggleModal((oldState) => ({
        ...oldState,
        [type]: show
    }))
}

const updateValueGenerator = (type, setValue) => (e) => {
    const {value} = e.target;
    setValue((oldState) => ({
        ...oldState,
        [type]: value
    }))
}

const onPasswordEnterGenerator = (props, inputs, setLoginStatus) => () => {
    const {password} = inputs
    props.tryLogin(password, "password", (correct) => {
        setLoginStatus(correct ? "right" : "wrong")
    })
}

const onPINEnterGenerator = (props, inputs, setLoginStatus) => () => {
    const {pin} = inputs
    props.tryLogin(pin, "pin", (correct) => {
        if(correct){
            message.success("Request for temporary link was successful.\nCheck your messages!", 20)
        }
        else{
            message.error("Request for temporary link failed.", 4)
        }
        setLoginStatus(correct ? "right" : "wrong")
    })
}

const LoginForm = (props) => {
    const [modalVisible, toggleModalVisible] = useState({
        password: false,
        pin: false,
    })
    const [inputValues, setInputValue] = useState({
        pin: "",
        password: ""
    })
    const [loginStatus, setLoginStatus] = useState(null)

    useEffect(() => {
        const {passwordAttempt} = props
		if(passwordAttempt){
			props.tryLogin(passwordAttempt, "password", (correct) => {
                setLoginStatus(correct ? "right" : "wrong")
            })
		}
    }, [])

    useEffect(() => {
        toggleModalVisible(() => ({
            password: false,
            pin: false
        }))
    }, [loginStatus])

    return (
        <Space>
            <Card
                title="Login"
                extra={loginStatus == null ? <RightCircleOutlined /> : (loginStatus == "wrong" ? <CloseCircleOutlined /> : <CheckCircleOutlined />)}
            >
                <Button type="primary" onClick={toggleModalGenerator(true, "password", toggleModalVisible)}>
                    Password
                </Button>
                <Button onClick={toggleModalGenerator(true, "pin", toggleModalVisible)}>
                    PIN
                </Button>
            </Card>
            <Modal
                title="Password" 
                visible={modalVisible.password}
                onOk={onPasswordEnterGenerator(props, inputValues, setLoginStatus)}
                onCancel={toggleModalGenerator(false, "password", toggleModalVisible)}
            >
                <Input.Password 
                    placeholder="input password" 
                    onChange={updateValueGenerator('password', setInputValue)} 
                    onPressEnter={onPasswordEnterGenerator(props, inputValues, setLoginStatus)}
                    value={inputValues.password}
                />
            </Modal>
            <Modal
                title="PIN"
                visible={modalVisible.pin}
                onOk={onPINEnterGenerator(props, inputValues, setLoginStatus)}
                onCancel={toggleModalGenerator(false, "pin", toggleModalVisible)}
            >
                <Input.Password 
                    placeholder="input pin" 
                    onChange={updateValueGenerator('pin', setInputValue)} 
                    onPressEnter={onPINEnterGenerator(props, inputValues, setLoginStatus)}
                    value={inputValues.pin}
                />
            </Modal>
        </Space>
    )
}

export default LoginForm