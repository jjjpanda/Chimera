import React from "react"

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Label } from "recharts"
import { formatBytes } from "lib"
import Cookies from "js-cookie"
import colors from '../js/colors.js'

const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const name = payload[0].name == "Free Space" ? payload[0].name : `Camera ${payload[0].name}`
        const value = payload[0].dataKey == "size" ? formatBytes( payload[0].value, 2 ) : `${payload[0].value} image${payload[0].value > 1 ? "s" : ""}`
        return (
            <div style={{backgroundColor: "#000", color: "#fff"}}>
                {`${name} : ${value}`}
            </div>
        );
    }
  
    return null;
};

const FileStatsPieChart = (props) => {
    const sumSize = props.cameras.reduce((total, cam) => total+cam.size, 0)
    /* const bytesInTerabytes = 1099511627776
    const nearestTerabyte = Math.ceil(sumSize / bytesInTerabytes)
    const sizes = [
        ...props.cameras,
        {
            number: "Free Space",
            size: nearestTerabyte*bytesInTerabytes - sumSize
        }
    ]
    console.log(sizes, props.cameras) */
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip content={customTooltip} />
                <Pie 
                    data={props.cameras} dataKey="count" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={37} outerRadius={55}
                    onClick={props.onClick}
                >
                    {
                        props.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                </Pie>
                <Pie 
                    data={props.cameras} dataKey="size" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                    onClick={props.onClick}
                >
                    {
                        props.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                    <Label 
                        value={`${formatBytes(sumSize, 1)}`} 
                        position="center" 
                        style={{fill: Cookies.get("theme") == "dark" ? "white" : "black"}} 
                        onClick={props.onClick}
                    />
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    )
}

export default FileStatsPieChart