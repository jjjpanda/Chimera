import React from "react"
import useChimeraStatus from "../hooks/useChimeraStatus"

import {Tree, Card} from 'antd'
import {CheckCircleOutlined, WarningOutlined, LoadingOutlined } from '@ant-design/icons'

const StatusIcon = ({status}) => {
    switch(status){
        case "up":
            return <CheckCircleOutlined />
        case "down":
            return <WarningOutlined />
        default:
            return <LoadingOutlined />
    }
}

const StatusTree = () => {
    const [status] = useChimeraStatus()

    console.log("STATUS IN RENDER", status)

    return <Card
        title="Status"
        size="small"
        showIcon 
        selectable={true} 
        cover={
            <Tree  
                showIcon
                defaultExpandAll
                treeData={[{
                    key: "chimera",
                    title: "chimera",
                    children: [{
                        key: "command",
                        icon: <StatusIcon status={status.command} />,
                        title: "command",
                        isLeaf: true
                    },{
                        key: "schedule",
                        icon: <StatusIcon status={status.schedule} />,
                        title: "schedule",
                        isLeaf: true
                    },{
                        key: "storage",
                        icon: <StatusIcon status={status.storage} />,
                        title: "storage",
                        children: [{
                            key: "motion",
                            icon: <StatusIcon status={status.motion} />,
                            title: "motion",
                            isLeaf: true
                        }, {
                            key: "database",
                            icon: <StatusIcon status={status.database} />,
                            title: "database",
                            isLeaf: true
                        }]
                    },{
                        key: "livestream",
                        icon: <StatusIcon status={status.livestream} />,
                        title: "livestream",
                        children: JSON.parse(process.env.cameras).map((camera) => ({
                            key: `${camera}-live`,
                            icon: <StatusIcon status={status[`cam ${camera}`]} />,
                            title: camera,
                            isLeaf: true
                        }))
                    },{
                        key: "memory",
                        icon: <StatusIcon status={status.memory} />,
                        title: "memory",
                        isLeaf: true
                    },{
                        key: "object",
                        icon: <StatusIcon status={status.object} />,
                        title: "object",
                        isLeaf: true
                    }]
                }]}
            />  
        }
    />
}

export default StatusTree