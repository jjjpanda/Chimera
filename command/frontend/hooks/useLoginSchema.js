import React, {useState, useEffect} from "react"

import { message } from "antd"

const toggleModalGenerator = (toggleModal) => (show, type) => {
	toggleModal((oldState) => ({
		...oldState,
		[type]: show
	}))
}

const updateValueGenerator = (type, setValue) => (e) => {
	const {value} = e.target
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

const useLoginSchema = (props) => {
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

	return [
		loginStatus, 
		modalVisible,
		toggleModalGenerator(toggleModalVisible),
		inputValues,
		onPasswordEnterGenerator(props, inputValues, setLoginStatus),
		onPINEnterGenerator(props, inputValues, setLoginStatus),
		updateValueGenerator("password", setInputValue),
		updateValueGenerator("pin", setInputValue)
	]
}

export default useLoginSchema