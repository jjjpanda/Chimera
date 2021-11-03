import React from 'react';
import ReactDOM from 'react-dom';
import {
    BrowserRouter as Router,
    Link,
    Route,
    Redirect
} from 'react-router-dom';
import Main from "./app/Main.jsx"

import './css/style.less'
import Cookies from 'js-cookie';
import LoadingIcon from './app/LoadingIcon.jsx';

import { request } from './js/request.js'

const timeout = 750

import * as FastClick from 'fastclick'
import LoginForm from './app/LoginForm.jsx';
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function() {
        FastClick.attach(document.body);
    }, false);
}

class App extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            loaded: false,
            loggedIn: false,
            key: 1,
            timestamp: new Date()
        }
    }

    attemptLogin = (password) => {
        return request("/authorization/login", {
            method: "POST",
            headers: {
                "Accept": 'application/json',
                "Content-Type": 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({password})
        }, (prom) => {
            return prom.then(res => {
                return res.json()
            }, (err)=> {
                return {error: true}
            }) 
        })
    }

    attemptVerification = () => {
        return request("/authorization/verify", {
            method: "POST",
            headers: {
                "Accept": 'application/json',
                "Content-Type": 'application/json',
            },
        }, (prom) => {
            return prom.then(res => {
                return res.json()
            }, (err)=> {
                return {error: true}
            }) 
        })
    }

    handleLoginAttempt = (res, timestamp, callback=()=>{}) => {
        console.log('login attempt', res)
        callback(res.error)
        setTimeout(() => this.setState(() => ({loaded: true, loggedIn: !res.error}), () => {
            setTimeout(() => {
                this.setState((oldState) => ({
                    key: oldState.key + 1
                }), () => console.log("APP KEY", this.state.key))
            }, Math.max(0, timeout - (new Date() - timestamp)))
        }), 500)
    }

    componentDidMount() {
        console.log(`TOKEN ${Cookies.get('bearertoken')}`);
        (Cookies.get('bearertoken') == undefined ? this.attemptLogin: this.attemptVerification)("").then(res => {
            this.handleLoginAttempt(res, this.state.timestamp)
        })
    }

    render() {
        const LoginPage = <LoginForm loginReq={this.attemptLogin} handler ={this.handleLoginAttempt} timestamp={this.state.timestamp} />
        if(this.state.loaded){
            return (
                <Router>
                    <Route 
                        path="/" 
                        render={({location}) => {
                            if(location.search == "?loginForm") {
                                return this.state.loggedIn ? <Redirect to="/" /> : LoginPage
                            }
                            else {
                                return this.state.loggedIn ? <Main /> : <Redirect to="/?loginForm" /> 
                            } 
                        }} />
                </Router>
            )
        }
        else{
            return <LoadingIcon />
        }
    }
}

ReactDOM.render(<App />,
    document.getElementById('root'),
);