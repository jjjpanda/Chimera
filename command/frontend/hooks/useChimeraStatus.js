import {useState, useEffect} from 'react'
import { request, statusProcessing } from "../js/request.js"

const useChimeraStatus = () => {
    const [status, setStatus] = useState({
        command: "loading",
        schedule: "loading",
        storage: "loading",
        motion: "loading",
        database: "loading",
        livestream: "loading",
        ...JSON.parse(process.env.cameras).reduce((obj, camera) => ({ ...obj, [`cam ${camera}`]: "loading"}), {}),
        memory: "loading",
        object: "loading"
    })

    const getOptions = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        mode: "cors"
    }

    const simpleStatusUrls = [
        { statusType: "command", url: "/command/health" },
        { statusType: "schedule", url: "/schedule/health" },
        { statusType: "storage", url: "/storage/health" },
        { statusType: "motion", url: "/motion/status" },
        { statusType: "database", url: "/database/status" },
        { statusType: "livestream", url: "/livestream/health" },
        ...JSON.parse(process.env.cameras).map((camera, index) => ({ statusType: `cam ${camera}`, url: `/livestream/status?camera=${index+1}` })),
        { statusType: "memory", url: "/memory/status" },
        { statusType: "object", url: "/object/status" }
    ]
    
    console.log(simpleStatusUrls, status)

    useEffect(() => {
        for(const {statusType, url} of simpleStatusUrls){
            request(url, getOptions,  (prom) => {
                statusProcessing(prom, 200, (successful) => {
                    setStatus((prevStatus) => ({
                        ...prevStatus,
                        [statusType]: successful ? "up" : "down"
                    }))
                })
            })
        }
    }, [])

    return [status]
}

export default useChimeraStatus