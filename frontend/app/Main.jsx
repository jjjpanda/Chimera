import React from 'react';

import { 
    Button,
    List    
} from 'antd-mobile';

import {request, jsonProcessing} from './../js/request.js'

class Main extends React.Component {

    constructor(props){
        super(props)
        this.state = {
            processList: []
        }
    }

    componentDidMount = () => {
        this.updateProcesses()
    }

    updateProcesses = () => {
        request("/listProcess", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            }
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log(data)
                this.setState((oldState) => {
                    return{
                        videoList: Array.from(new Set([...oldState.processList, ...data.list]))
                    }
                })
            })
        })
    }

    render () {
        console.log("STATE FROM RENDER", this.state)
        return (
            <List style={{ margin: '5px 0', backgroundColor: 'white' }}>
                {this.state.processList.map(process => {
                    return (
                        <List.Item
                            extra={<Button type="ghost" size="small" inline>X</Button>}
                            multipleLine
                        >
                            {process.type == "mp4" ? "Video" : (process.type == "zip" ? "Zip" : "???")}
                            <List.Item.Brief>
                                {process.link}
                            </List.Item.Brief>
                        </List.Item>
                    )
                })}               
            </List>
        )
    }
}

export default Main