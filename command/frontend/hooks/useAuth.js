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

const attemptSetup = (username, password, token) =>
	request("/authorization/setup", {
		method: "POST",
		headers: { "Accept": "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ username, password, token })
	}, authPromiseHandler)

const handleLoginAttempt = (verified, role, timestamp, setState) => {
	setTimeout(() => {
		setState(s => ({ ...s, loggedIn: verified, role: role || null }))
		setTimeout(() => {
			setState(s => ({ ...s, loaded: true }))
		}, Math.max(0, timeout - (new Date() - timestamp)))
	}, 500)
}

const useAuth = () => {
	const [state, setState] = useState({
		loaded: false,
		setup: null,
		tokenRequired: false,
		loggedIn: false,
		role: null,
		timestamp: new Date()
	})

	useEffect(() => {
		checkStatus().then(res => {
			if (res.error) {
				setState(s => ({ ...s, setup: null, loaded: true }))
				return
			}
			const isSetup = res.setup === true
			setState(s => ({ ...s, setup: isSetup, tokenRequired: !!res.tokenRequired }))
			if (!isSetup) {
				handleLoginAttempt(false, null, state.timestamp, setState)
				return
			}
			const bearerToken = Cookies.get("bearertoken")
			if (bearerToken) {
				attemptVerification().then(res => {
					handleLoginAttempt(!res.error, res.role, state.timestamp, setState)
				})
			} else {
				handleLoginAttempt(false, null, state.timestamp, setState)
			}
		})

		const refreshRole = () => {
			if (document.hidden) return
			const bearerToken = Cookies.get("bearertoken")
			if (bearerToken) {
				attemptVerification().then(res => {
					if (res.error) handleLoginAttempt(false, null, state.timestamp, setState)
					else setState(s => ({ ...s, role: res.role }))
				})
			}
		}
		document.addEventListener("visibilitychange", refreshRole)
		return () => document.removeEventListener("visibilitychange", refreshRole)
	}, [])

	const tryLogin = (username, password, callback) => {
		attemptLogin(username, password).then(res => {
			callback(!res.error)
			handleLoginAttempt(!res.error, res.role, state.timestamp, setState)
		})
	}

	const trySetup = (username, password, token, callback) => {
		attemptSetup(username, password, token).then(res => {
			if (!res.error) setState(s => ({ ...s, setup: true }))
			callback(!res.error)
		})
	}

	return [state.loaded, state.setup, state.tokenRequired, state.loggedIn, state.role, tryLogin, trySetup]
}

export default useAuth
