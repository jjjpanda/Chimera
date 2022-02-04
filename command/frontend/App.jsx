import React, {useEffect, useState} from "react"
import ReactDOM from "react-dom"
import {
	BrowserRouter as Router,
	Route,
	Routes,
	Navigate
} from "react-router-dom"
import ResponsiveMain from "./app/ResponsiveMain.jsx"

import "./css/style.less"
import LoadingIcon from "./app/LoadingIcon.jsx"
import LoginPage from "./app/LoginPage.jsx"
import ThemeProvider from "./app/ThemeProvider.jsx"

import * as FastClick from "fastclick"
import useAuth from "./hooks/useAuth.js"

if ("addEventListener" in document) {
	document.addEventListener("DOMContentLoaded", () => {
		FastClick.attach(document.body)
	}, false)
}

const App = () => {
	const [loaded, loggedIn, tryLogin] = useAuth()
	const [key, setKey] = useState(0)

	useEffect(() => {
		console.log("UPDATED CHIMERA KEY: ", key)
		setKey((k) => k+1)
	}, [loggedIn])

	return (
		<ThemeProvider>
			<Router key={`ROUTER-${key}`}>
				{loaded ? <Routes>
					<Route 
						key={`ROUTE-${key}-1`}
						path="/login/:password" 
						element={loggedIn ? <Navigate to="/" /> : <LoginPage withPassword tryLogin={tryLogin} />}
					/>
					<Route 
						key={`ROUTE-${key}-2`}
						path="/login" 
						element={loggedIn ? <Navigate to="/" /> : <LoginPage tryLogin={tryLogin} />} 
					/>
					<Route 
						key={`ROUTE-${key}-3`}
						path="/:route" 
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
					<Route 
						key={`ROUTE-${key}-4`}
						path="/" 
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
				</Routes> : <LoadingIcon />}
			</Router>
		</ThemeProvider>
	)
}

ReactDOM.render(<App />,
	document.getElementById("root"),
)