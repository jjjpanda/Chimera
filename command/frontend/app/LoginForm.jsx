import React from 'react';
import ReactDOM from 'react-dom';
import { Card, WingBlank, Button, Modal, LocaleProvider, Icon, Toast } from 'antd-mobile';
import enUS from 'antd-mobile/lib/locale-provider/en_US';
class LoginForm extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            loginStatus: null
        }
    }

    statusHandler = (err) => {
        this.setState(() => ({
            loginStatus: !err ? "right" : "wrong"
        }))
    }

    onPasswordEnter = (password) => {
        this.props.loginReq(password).then(req => this.props.handler(req, this.props.timestamp, this.statusHandler))
    }

    onPINEnter = (pin) => {
        this.props.loginReq(pin, "/authorization/requestLink", {pin}).then(({error}) => {
            this.setState(() => ({
                loginStatus: !error ? "right" : "wrong"
            }), () => {
                if(!error){
                    Toast.success("Request for temporary link was successful.\nCheck your messages!", 20)
                }
                else{
                    Toast.fail("Request for temporary link failed.", 4)
                }
            })
        })
    }
    
    componentDidMount() {
        const {passwordAttempt} = this.props
        if(passwordAttempt != undefined){
            this.props.loginReq(passwordAttempt).then(res => {
                this.props.handler(res, this.props.timestamp, this.statusHandler)
            })
        }
    }

    render() {
        return (
            <LocaleProvider locale={enUS}>
                <WingBlank size="sm">
                    <Card>
                        <Card.Header
                            title={"  ---Login---"}
                            thumb={<Icon type={this.state.loginStatus == null ? "right" : (this.state.loginStatus == "wrong" ? "cross-circle" : "check-circle")}  />}
                        />
                        <Card.Body>
                            <WingBlank size="sm">
                                <Button 
                                    onClick={
                                        () => Modal.prompt('Password', '', [{text: "Cancel"}, {text: "Enter", onPress: this.onPasswordEnter}], 'secure-text')
                                    }
                                    type="primary"
                                >
                                    Password
                                </Button>
                                <Button 
                                    onClick={
                                        () => Modal.prompt('PIN', '', [{text: "Cancel"}, {text: "Enter", onPress: this.onPINEnter}], 'secure-text')
                                    }
                                    type="ghost"
                                >
                                    PIN
                                </Button>
                            </WingBlank>
                        </Card.Body>
                        <Card.Footer
                            extra={"2 methods to sign in"}
                        />
                    </Card>
                </WingBlank>
            </LocaleProvider>
        )
    }
}

export default LoginForm