import React, { useState, useEffect } from 'react';

import {request, jsonProcessing} from "../js/request.js"

const listTasks = (setState) => {
    setState(() => ({
        processList: [],
        loading: true
    }))
    request("/task/list", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    }, (prom) => {
        jsonProcessing(prom, (data) => {
            if(data && "tasks" in data){
                const {tasks} = data
                setState(() => ({
                    processList: tasks,
                    loading: false 
                }))
            }
            else{
                setState(() => ({
                    processList: [],
                    loading: false
                }))
            }
        })
    })
}

const afterRequestCallbackGenerator = (key, setKey) => (prom) => {
    jsonProcessing(prom, (data) => {
        setTimeout(() => {
           setKey(key+1) 
        }, 1500)
    })
}

const restartTasksGenerator = (key, setKey) => (id) => {
    request("/task/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const stopTasksGenerator = (key, setKey) => (id) => {
    request("/task/stop", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const deleteTasksGenerator = (key, setKey) => (id) => {
    request("/task/destroy", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const useTasks = () => {
    const [state, setState] = useState({
        processList: [],
        loading: false
    })

    const [key, setKey] = useState(1)

    useEffect(() => {
        listTasks(setState)
    }, [key])

    return [
        state, 
        restartTasksGenerator(key, setKey),
        stopTasksGenerator(key, setKey),
        deleteTasksGenerator(key, setKey)
    ]
}

export default useTasks;