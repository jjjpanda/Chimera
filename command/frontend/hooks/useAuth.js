import {useEffect, useState} from "react"

import Cookies from "js-cookie"
import { request } from "../js/request.js"

const timeout = 750

const authPromiseHandler = (prom) => {
	return prom.then(res => res.json())
		.catch(() => ({ error: true }))
}

const checkStatus = () =>
	request("/authorization/status", { method: "GET" }, authPromiseHandler)

const attemptVerification = () =>
	request("/authorization/verify", {
		method: "POST",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
	}, authPromiseHandler)

const attemptLogin = (username, password) =>
	request("/authorization/login", {
		method: "POST",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ username, password })
	}, authPromiseHandler)

const attemptSetup = (username, password) =>
	request("/authorization/setup", {
		method: "POST",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ username, password })
	}, authPromiseHandler)

const handleLoginAttempt = (verified, timestamp, setState) => {
	setTimeout(() => {
		setState(s => ({ ...s, loggedIn: verified }))
		setTimeout(() => {
			setState(s => ({ ...s, loaded: true }))
		}, Math.max(0, timeout - (new Date() - timestamp)))
	}, 500)
}

const useAuth = () => {
	const [state, setState] = useState({
		loaded: false,
		setup: null,
		loggedIn: false,
		timestamp: new Date()
	})

	useEffect(() => {
		checkStatus().then(res => {
			if (res.error) {
				setState(s => ({ ...s, setup: false }))
				handleLoginAttempt(false, state.timestamp, setState)
				return
			}
			const isSetup = res.setup === true
			setState(s => ({ ...s, setup: isSetup }))
			if (!isSetup) {
				handleLoginAttempt(false, state.timestamp, setState)
				return
			}
			const bearerToken = Cookies.get("bearertoken")
			if (bearerToken) {
				attemptVerification().then(res => {
					handleLoginAttempt(!res.error, state.timestamp, setState)
				})
			} else {
				handleLoginAttempt(false, state.timestamp, setState)
			}
		})
	}, [])

	const tryLogin = (username, password, callback) => {
		attemptLogin(username, password).then(res => {
			callback(!res.error)
			handleLoginAttempt(!res.error, state.timestamp, setState)
		})
	}

	const trySetup = (username, password, callback) => {
		attemptSetup(username, password).then(res => {
			if (!res.error) setState(s => ({ ...s, setup: true }))
			callback(!res.error)
		})
	}

	return [state.loaded, state.setup, state.loggedIn, tryLogin, trySetup]
}

export default useAuth
