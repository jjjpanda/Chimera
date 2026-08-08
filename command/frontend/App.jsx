import React, { useEffect, useState } from "react"
import { I18nextProvider } from "react-i18next"
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
import ChangePasswordForm from "./app/ChangePasswordForm.jsx"
import AuthContext from "./app/AuthContext.jsx"
import { ThemeProvider } from "./app/ThemeContext.jsx"
import { LanguageProvider } from "./app/LanguageContext.jsx"
import useAuth from "./hooks/useAuth.js"
import ToastContainer from "./components/ToastContainer.jsx"
import i18n from "./js/i18n.js"

const AppInner = ({ loaded, setup, tokenRequired, loggedIn, role, forcePasswordChange, tryLogin, trySetup, signOut, changePassword, routerKey }) => {
	if (!loaded) return <LoadingIcon />

	if (setup === false) return <SetupForm trySetup={trySetup} tokenRequired={tokenRequired} />

	if (loggedIn && forcePasswordChange) return <ChangePasswordForm changePassword={changePassword} />

	return (
		<AuthContext.Provider value={{ role, signOut, changePassword }}>
			<Router key={`ROUTER-${routerKey}`}>
				<Routes>
					<Route
						key={`ROUTE-${routerKey}-1`}
						path="/login"
						element={loggedIn ? <Navigate to="/" /> : <LoginPage tryLogin={tryLogin} />}
					/>
					<Route
						key={`ROUTE-${routerKey}-2`}
						path="/:route"
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
					<Route
						key={`ROUTE-${routerKey}-3`}
						path="/"
						element={loggedIn ? <ResponsiveMain /> : <Navigate to="/login" />}
					/>
				</Routes>
			</Router>
		</AuthContext.Provider>
	)
}

const App = () => {
	const { loaded, setup, tokenRequired, loggedIn, role, forcePasswordChange, tryLogin, trySetup, signOut, changePassword, theme: serverTheme, language: serverLanguage } = useAuth()
	const [key, setKey] = useState(0)

	useEffect(() => {
		setKey((k) => k + 1)
	}, [loggedIn])

	return (
		<I18nextProvider i18n={i18n}>
			<LanguageProvider serverLanguage={serverLanguage} loggedIn={loggedIn}>
				<ThemeProvider serverTheme={serverTheme} loggedIn={loggedIn}>
					<ToastContainer />
					<AppInner
						loaded={loaded}
						setup={setup}
						tokenRequired={tokenRequired}
						loggedIn={loggedIn}
						role={role}
						forcePasswordChange={forcePasswordChange}
						tryLogin={tryLogin}
						trySetup={trySetup}
						signOut={signOut}
						changePassword={changePassword}
						routerKey={key}
					/>
				</ThemeProvider>
			</LanguageProvider>
		</I18nextProvider>
	)
}

export default App
