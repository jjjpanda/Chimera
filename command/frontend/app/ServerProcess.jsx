import React from 'react';

import { 
    Button,
    List,
    Card,
    Switch,
    ActivityIndicator
} from 'antd-mobile';

import {request, jsonProcessing} from '../js/request.js'
import ProcessCard from './ProcessCard.jsx';
import Cookies from 'js-cookie';
class ServerProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            status: {
                running: false,
                duration: "00:00:00"
            },
            loading: true,
        }
    }

    componentDidMount = () => {
        this.status()
    }

    status = () => {
        request("/command/serverStatus", {
            method: "POST",
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    status: {
                        running: data.running, 
                        duration: data.duration
                    },
                    loading: false
                }))
            })
        })
    }

    serverUpdate = () => {
        this.setState({status: {
                duration: "00:00:00"
        }, loading: true}, () => {
            request("/command/serverUpdate", {
                method: "POST",
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    setTimeout(() => {
                        this.setState({loading: false}, () => {
                            this.status()
                        })
                        
                    }, 1000)
                })
            })
        })   
    }

    serverInstall = () => {
        this.setState({status: {
                duration: "00:00:00"
        }, loading: true}, () => {
            request("/command/serverInstall", {
                method: "POST",
            }, (prom) => {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    setTimeout(() => {
                        this.setState({loading: false}, () => {
                            this.status()
                        })
                        
                    }, 1000)
                })
            })
        })   
    }

    render() {
        return ( 
            <ProcessCard 
                title= {"Node Server"}
                extra = {(this.state.loading ? <ActivityIndicator />: <div>
                    <Button type="ghost" size="small" inline onClick={this.serverUpdate}>Update</Button>
                    <Button size="small" inline onClick={this.serverInstall}>Install</Button>
                </div>)}
                body= {<div>
                    Status: {this.state.loading ? <ActivityIndicator /> : (this.state.status.running ? "On": "Off")}
                </div>}
                footer={<div>
                    CPU Time: {this.state.status.duration}
                </div>}
            />
        )
    }
}

export default ServerProcess