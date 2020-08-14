import React from 'react';

import { 
    Flex,
    Modal, 
    Button,
    SegmentedControl,
    DatePicker,
    List,
    Checkbox,
    WhiteSpace,
    Toast
} from 'antd-mobile';

import enUs from 'antd-mobile/lib/date-picker/locale/en_US';

import {request, jsonProcessing, downloadProcessing} from './../js/request.js'
import moment from 'moment';

class SaveProcess extends React.Component{

    constructor(props){
        super(props)
        this.state ={
            camera: 0,
            cameras: ['1', '2', '3'],
            visible: false,
            startDate: moment().subtract(1, "day").toDate(),
            endDate: moment().toDate(),
            download: false,
            downloading: true,
        }
    }

    processBody = () => {
        console.log(this.state.startDate, this.state.endDate)
        const body = JSON.stringify({
            camera: (this.state.camera+1).toString(),
            start: moment(this.state.startDate).second(0).format("YYYYMMDD-HHmmss"),
            end: moment(this.state.endDate).second(0).format("YYYYMMDD-HHmmss"),
            save: !this.state.download
        })
        console.log(body)
        return body
    }

    createVideo = () => {
        if(this.state.download){
            Toast.loading("Generating", 0)
        }
        request("/createVideo", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: this.processBody()
        }, (prom) => {
            if(this.state.download){
                downloadProcessing(prom, () => {
                    this.closeModal()
                })
            }
            else {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.closeModal()
                })
            }
        })
    }

    createZip = () => {
        if(this.state.download){
            Toast.loading("Generating", 0)
        }
        request("/createZip", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: this.processBody()
        }, (prom) => {
            if(this.state.download){
                downloadProcessing(prom, () => {
                    this.closeModal()
                })
            }
            else {
                jsonProcessing(prom, (data) => {
                    console.log(data)
                    this.closeModal()
                })
            }
        })
    }

    openModal = () => {
        this.setState(() => ({visible: true}))
    }

    closeModal = () => {
        this.setState(() => ({visible: false}), this.props.update)
    }

    render () {
        console.log(this.state)
        return (
            <Flex.Item>
                <Button icon="check-circle-o" onClick={this.openModal}>
                    SAVE
                </Button>
                <Modal
                    popup
                    maskClosable
                    visible={this.state.visible}
                    onClose={this.closeModal}
                    animationType="slide-up"
                >
                    <div>Camera</div>
                    <SegmentedControl
                        selectedIndex={this.state.camera}
                        values={this.state.cameras}
                        onValueChange = {(cam) => {
                            this.setState(() => {
                                return {
                                    camera: this.state.cameras.findIndex(camera => camera == cam)
                                }
                            })
                        }}
                        tintColor={'#ff0000'}
                    />

                    <List>
                        <DatePicker
                            value={this.state.startDate}
                            locale={enUs}
                            onChange={date => this.setState({ startDate: date })}
                        >
                            <List.Item arrow="horizontal">
                                Start Date
                            </List.Item>
                        </DatePicker>

                    
                        <DatePicker
                            value={this.state.endDate}
                            locale={enUs}
                            onChange={date => this.setState({ endDate: date })}
                        >
                            <List.Item arrow="horizontal">
                                End Date
                            </List.Item>
                        </DatePicker>

                        <Checkbox.CheckboxItem checked={this.state.download} onChange={(e) => this.setState({ download : e.target.checked })} >Direct Download</Checkbox.CheckboxItem>
                    </List>
                
                    <WhiteSpace size="md" />

                    <Flex>
                        <Flex.Item>
                            <Button icon="check-circle-o" onClick={this.createVideo}>VIDEO</Button>
                        </Flex.Item>
                        <Flex.Item>
                            <Button icon="check-circle-o" onClick={this.createZip}>ZIP</Button>
                        </Flex.Item>
                    </Flex>

                </Modal>
            </Flex.Item>
        )
    }

}

export default SaveProcess