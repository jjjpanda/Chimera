import React from 'react';
import ReactDOM from 'react-dom';
import { InputItem, WingBlank, Button } from 'antd-mobile';

class LoginForm extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            password: "",
            passwordStatus: null
        }
    }

    onChange = (newValue) => {
        this.setState(() => ({ password: newValue }))
    }

    onClick = () => {
        this.props.loginReq(this.state.password).then(req => this.props.handler(req, this.props.timestamp, (err) => {
            this.setState(() => ({
                passwordStatus: !err ? "right" : "wrong"
            }))
        }))
    }

    render() {
        return (
            <WingBlank size="sm">
                <InputItem type="password" value={this.state.password} onChange={this.onChange}/>
                <Button 
                    icon={this.state.passwordStatus == null ? "right" : (this.state.passwordStatus == "wrong" ? "cross-circle" : "check-circle")} 
                    onClick ={this.onClick}
                >
                    ENTER
                </Button>
            </WingBlank>
        )
    }
}

export default LoginForm