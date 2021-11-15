import React from 'react';
import ReactDOM from 'react-dom';
import {
    BrowserRouter as Router,
    Route,
    Routes,
    Navigate
} from 'react-router-dom';
import Main from "./app/Main.jsx"

import './css/style.less'
import Cookies from 'js-cookie';
import LoadingIcon from './app/LoadingIcon.jsx';
import LoginPage from './app/LoginPage.jsx';

import { request } from './js/request.js'

const timeout = 750

import * as FastClick from 'fastclick'

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
        if(Cookies.get('bearertoken') != undefined){
            this.attemptVerification().then(res => {
                this.handleLoginAttempt(res, this.state.timestamp)
            })
        }
        else{
            this.setState(() => ({
                loaded: true,
                loggedIn: false
            }))
        }
    }

    render() {
        const loginProps = {
            loginReq: this.attemptLogin,
            handler: this.handleLoginAttempt,
            timestamp: this.state.timestamp
        }
        return (
            <Router>
                {this.state.loaded ? <Routes>
                    <Route path="/login/:password" element={this.state.loggedIn ? <Navigate to="/" /> : <LoginPage withPassword {...loginProps} />}
                    />
                    <Route path="/login" element={this.state.loggedIn ? <Navigate to="/" /> : <LoginPage {...loginProps} />}
                    />
                    <Route path="/" element={this.state.loggedIn ? <Main /> : <Navigate to="/login" />}/>
                </Routes> : <LoadingIcon />}
            </Router>
        )
    }
}

ReactDOM.render(<App />,
    document.getElementById('root'),
);

/* 
    const [key, value] = location.search.split('=')
    console.log(key, value, this.state.loggedIn)
    if(key == "?loginForm") {
        if(this.state.loggedIn){
            return <div>bruh</div>//this.props.history.push({pathname: "/"}) 
        }
        else{
            if(value == undefined){
                return <LoginForm  />
            }
            else{
                return <div>bruh</div>//this.props.history.push({pathname: "/", state: { otp: value }})
            }
        }
    }
    else {
        if(this.state.loggedIn) {
            return <Main /> 
        }
        else{
            return <div>bruh</div>//this.props.history.push({pathname: "/?loginForm"})
        }
    }  
*/