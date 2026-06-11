import React, { useEffect, useState } from "react"
import {
	BrowserRouter as Router,
	Route,
	Routes,
	Navigate
} from "react-router-dom"

import ResponsiveMain from "./app/ResponsiveMain.jsx"
import LoadingIcon from "./app/LoadingIcon.jsx"
import LoginPage from "./app/LoginPage.jsx"
import SetupForm from "./app/SetupForm.jsx"
import AuthContext from "./app/AuthContext.jsx"
import useAuth from "./hooks/useAuth.js"

const App = () => {
	const [loaded, setup, tokenRequired, loggedIn, role, tryLogin, trySetup, signOut] = useAuth()
	const [key, setKey] = useState(0)

	useEffect(() => {
		setKey((k) => k + 1)
	}, [loggedIn])

	if (!loaded) return <LoadingIcon />

	if (setup === false) return <SetupForm trySetup={trySetup} tokenRequired={tokenRequired} />

	return (
		<AuthContext.Provider value={{ role, signOut }}>
			<Router key={`ROUTER-${key}`}>
				<Routes>
					<Route
						key={`ROUTE-${key}-1`}
						path="/login"
						element={loggedIn ? <Navigate to="/" /> : <LoginPage tryLogin={tryLogin} />}
					/>
					<Route
						key={`ROUTE-${key}-2`}
						path="/:route"
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
					<Route
						key={`ROUTE-${key}-3`}
						path="/"
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
				</Routes>
			</Router>
		</AuthContext.Provider>
	)
}

export default App
