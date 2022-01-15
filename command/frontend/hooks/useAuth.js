import {useEffect, useState} from 'react';

import Cookies from "js-cookie"
import { request } from "../js/request.js"

const timeout = 750

const handleAuthResponse = (res) => {
    return res.json()
}

const catchAuthError = (err)=> {
    return {error: true}
}

const authPromiseHandler = (prom) => {
    return prom.then(handleAuthResponse)
                .catch(catchAuthError)
}

const attemptVerification = () => {
	return request("/authorization/verify", {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
	}, authPromiseHandler)
}

const attemptLogin = (password, type) => {
    const url = type == "password" ? "/authorization/login" : "/authorization/requestLink"
	return request(url, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		credentials: "include",
		body: JSON.stringify({[type.toLowerCase()]: password})
	}, authPromiseHandler)
}

const handleLoginAttempt = (verified, timestamp, setState) => {
	console.log("login attempt", verified)
	setTimeout(() => {
		setState((oldState) => ({
			...oldState,
			loggedIn: verified
		}))
		setTimeout(() => {
			setState((oldState) => ({
				...oldState,
			    loaded: true
			}))
		}, Math.max(0, timeout - (new Date() - timestamp)))
	}, 500)
}

const useAuth = () => {
    const [state, setState] = useState({
		loaded: false,
		loggedIn: false,
        bearerToken: Cookies.get("bearertoken"),
		timestamp: new Date()
	})

    useEffect(() => {
        if(state.bearerToken){
            attemptVerification().then(res => {
                handleLoginAttempt(!res.error, state.timestamp, setState)
            })
        }
        else{
            handleLoginAttempt(false, state.timestamp, setState) 
        }
    }, [])
    
    const tryLogin = (input, type, callback) => {
        attemptLogin(input, type).then(res => {
            callback(!res.error)
            if(type == "password"){
                handleLoginAttempt(!res.error, state.timestamp, setState)
            }
        })
    }

    console.log("LOADED:", state.loaded, "\nLOGGED IN:", state.loggedIn)

    return [state.loaded, state.loggedIn, tryLogin]
}

export default useAuth