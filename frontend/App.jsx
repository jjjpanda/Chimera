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

const timeout = 500

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
        return fetch("/command/login", {
            method: "POST",
            headers: {
                "Accept": 'application/json',
                "Content-Type": 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({password})
        }).then(res => {
            return res.json()
        }, (err)=> {
            return {error: true}
        })
    }

    attemptVerification = () => {
        return fetch("/command/verify", {
            method: "POST",
            headers: {
                "Accept": 'application/json',
                "Content-Type": 'application/json'
            },
        }).then(res => {
            return res.json()
        }, (err)=> {
            return {error: true}
        })
    }

    handleLoginAttempt = (res, timestamp) => {
        console.log('response', res)
        this.setState(() => ({loaded: true, loggedIn: !res.error}), () => {
            setTimeout(() => {
                this.setState((oldState) => ({
                    key: oldState.key + 1
                }), () => console.log("APP KEY", this.state.key))
            }, Math.max(0, timeout - (new Date() - timestamp)))
        })
    }

    componentDidMount() {
        console.log(`TOKEN ${Cookies.get('bearertoken')}`);
        (Cookies.get('bearertoken') == undefined ? this.attemptLogin: this.attemptVerification)("").then(res => {
            this.handleLoginAttempt(res, this.state.timestamp)
        })
    }

    render() {
        if(this.state.loaded){
            return (
                <Router>
                    <Route 
                        path="/" 
                        render={({location}) => {
                            if(location.search == "?loginForm") return this.state.loggedIn ? <Redirect to="/" /> : <LoginForm loginReq={this.attemptLogin} handler ={this.handleLoginAttempt} timestamp={this.state.timestamp} />
                            else return this.state.loggedIn ? <Main /> : <Redirect to="/?loginForm" />
                        }} />
                </Router>
            )
        }
        else{
            return <div>Loading...</div>
        }
    }
}

ReactDOM.render(<App />,
    document.getElementById('root'),
);