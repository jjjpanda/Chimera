import React from 'react';

import { 
    Button,
    List,
    Card,
    Switch,
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'

class MainProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            motionDisabled: false
        }
    }

    motionChange = (checked) => {
        this.setState({ motionDisabled: true }, () => {
            if(!checked){
                request("/motionStop", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        this.setState({ motionDisabled: false })
                        this.props.motionChange()
                    })
                })
            }
            else{
                request("/motionStart", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        this.setState({ motionDisabled: false })
                        this.props.motionChange()
                    })
                })
            }
        })   
    }

    serverUpdate = () => {
        //send req to update
        this.props.serverChange()
    }

    serverInstall = () => {
        //send req to install
        this.props.serverChange()
    }

    render() {
        return (
            <div>
                <Card >
                    <Card.Header 
                        extra={<Switch checked = {this.props.motionStatus.running} onChange={this.motionChange}/>} 
                    />
                    Motion: {this.props.motionStatus.running ? "on": "off"}
                    <Card.Footer 
                        content={<div> {this.props.motionStatus.duration} </div>} 
                    />
                </Card>            
                <Card>
                    <Card.Header 
                        extra={<div>
                            <Button type="ghost" size="small" inline onClick={this.serverUpdate}>Update</Button>
                            <Button size="small" inline onClick={this.serverInstall}>Install</Button>
                        </div>}
                    />
                    Status: {this.props.serverStatus.running ? "on": "off"}
                    <Card.Footer 
                        content={<div> {this.props.serverStatus.duration} </div>} 
                    />                   
                </Card>
            </div>
        )
    }
}

export default MainProcess