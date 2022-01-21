import React from "react"
import useFileMetrics from "../hooks/useFileMetrics.js"

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Label } from "recharts"

import Cookies from "js-cookie"
import { formatBytes } from "lib"

import cameraInfo from '../js/cameraInfo.js'
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
    const [state, setState, handleDelete] = useFileMetrics({
		loading: "refreshing",
		cameras: JSON.parse(process.env.cameras).map(cameraInfo),
		days: 7
	})

    const sumSize = state.cameras.reduce((total, cam) => total+cam.size, 0)

    return (
        <ResponsiveContainer>
            <PieChart>
                <Tooltip content={customTooltip} />
                <Pie 
                    data={state.cameras} dataKey="count" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={37} outerRadius={55}
                    onClick={handleDelete}
                >
                    {
                        state.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                </Pie>
                <Pie 
                    data={state.cameras} dataKey="size" nameKey="number" 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                    onClick={handleDelete}
                >
                    {
                        state.cameras.map((entry, index) => <Cell fill={colors[index % colors.length]}/>)
                    }
                    <Label 
                        value={`${formatBytes(sumSize, 1)}`} 
                        position="center" 
                        style={{fill: Cookies.get("theme") == "dark" ? "white" : "black"}} 
                        onClick={handleDelete}
                    />
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    )
}

export default FileStatsPieChart