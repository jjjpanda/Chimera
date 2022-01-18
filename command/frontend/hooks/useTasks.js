import React, { useState, useEffect } from 'react';

import {request, jsonProcessing} from "../js/request.js"

const listProcesses = (setState) => {
    setState(() => ({
        processList: [],
        loading: true
    }))
    request("/convert/listProcess", {
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

const restartProcessGenerator = (key, setKey) => (id) => {
    request("/convert/startProcess", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const cancelProcessGenerator = (key, setKey) => (id) => {
    request("/convert/cancelProcess", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id
        })
    }, afterRequestCallbackGenerator(key, setKey))
}

const deleteProcessGenerator = (key, setKey) => (id) => {
    request("/convert/deleteProcess", {
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

    useEffect(() => {
        listProcesses(setState)
    }, [key])

    return [
        state, 
        restartProcessGenerator(key, setKey),
        cancelProcessGenerator(key, setKey),
        deleteProcessGenerator(key, setKey)
    ]
}

export default useTasks;