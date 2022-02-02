import React from 'react';

import { Modal } from 'antd'
import Scheduler from '../app_v2/Scheduler'

import {request, jsonProcessing} from "../js/request.js"

const useScheduler = () => {
    const scheduleTaskRequest = (url, body, cronString) => {
        request("/task/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({url, body, cronString})
        }, (prom) => {
            jsonProcessing(prom, (data) => {
                console.log("SCHEDULED", url, body, cronString, "RESPONSE", data)
                Modal.destroyAll()
            })
        })
    }

    const scheduleTask = (url, body) => {
        Modal.destroyAll()
        Modal.confirm({
            title: "Enter CRON String",
            content: (<Scheduler 
                url={url}
                body={body}
                cronString={""}
                onEnter={scheduleTaskRequest}
            />),
            okText: "Cancel",
            cancelButtonProps: { hidden: true }
        })
    }

    return [scheduleTask]
}

export default useScheduler