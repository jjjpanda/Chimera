import React from "react"
import {
	useParams
} from "react-router-dom"
import LoginForm from "./LoginForm.jsx"

const LoginPage = (props) => {
	if(props.withPassword){
		const {password} = useParams()
		return <LoginForm passwordAttempt={password} {...props} />
	}
	else{
		return <LoginForm {...props} />
	}
}

export default LoginPage