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

class WebDAVProcess extends React.Component {
    constructor(props){
        super(props)
        this.state = {
            status: {
                running: false,
            },
            loading: true
        }
    }

    componentDidMount = () => {
        this.status()
    }

    status = () => {
        fetch("/webdavStatus", {
            method: "POST"
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState(() => ({
                    status: {
                        running: data.running,
                    },
                    loading: false
                }))
            })
        });
    }

    change = (checked) => {
        this.setState({
            loading: true
        }, () => {
            if(!checked){
                fetch("/webdavOff", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status()
                        }, 1000)
                    })
                })
            }
            else{
                fetch("/webdavOn", {
                    method: "POST"
                }, (prom) => {
                    jsonProcessing(prom, (data) => {
                        console.log(data)
                        setTimeout(() => {
                            this.status()
                        }, 1000)
                    })
                })
            }
        })   
    }

    render() {
        return (
            <ProcessCard 
                title= {"WebDAV Server"}
                extra = {<div>
                    <Switch checked = {this.state.status.running} disabled = {this.state.loading} onChange={this.change} />
                </div>}
                body= {<div>
                    Status: {this.state.loading ? <ActivityIndicator /> : (this.state.status.running ? "On": "Off")}
                </div>}
                footer={<div>
                    
                </div>}
            />
        )
    }
}

export default WebDAVProcess