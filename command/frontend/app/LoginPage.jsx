import React from "react"
import LoginForm from "./LoginForm.jsx"

const LoginPage = (props) => (
	<div className="min-h-screen bg-bg flex items-center justify-center">
		<LoginForm {...props} />
	</div>
)

export default LoginPage
