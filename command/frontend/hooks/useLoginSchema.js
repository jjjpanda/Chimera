import {useState, useEffect} from "react"

const toggleModalGenerator = (toggleModal) => (show) => {
	toggleModal(show)
}

const updateValueGenerator = (type, setValue) => (e) => {
	const {value} = e.target
	setValue((oldState) => ({
		...oldState,
		[type]: value
	}))
}

const onLoginEnterGenerator = (props, inputs, setLoginStatus, setLoginError) => () => {
	const {username, password} = inputs
	props.tryLogin(username, password, (correct, errors) => {
		setLoginStatus(correct ? "right" : "wrong")
		setLoginError(correct ? null : errors)
	})
}

const useLoginSchema = (props) => {
	const [modalVisible, toggleModalVisible] = useState(false)
	const [inputValues, setInputValue] = useState({
		username: "",
		password: ""
	})
	const [loginStatus, setLoginStatus] = useState(null)
	const [loginError, setLoginError] = useState(null)


	useEffect(() => {
		toggleModalVisible(false)
	}, [loginStatus])

	return [
		loginStatus,
		modalVisible,
		toggleModalGenerator(toggleModalVisible),
		inputValues,
		onLoginEnterGenerator(props, inputValues, setLoginStatus, setLoginError),
		updateValueGenerator("username", setInputValue),
		updateValueGenerator("password", setInputValue),
		loginError
	]
}

export default useLoginSchema
