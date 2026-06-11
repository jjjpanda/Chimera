import React from "react"
import useFileMetrics from "../hooks/useFileMetrics.js"
import useCameras from "../hooks/useCameras.js"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Label } from "recharts"
import NavigateToRoute from "./NavigateToRoute.jsx"

import formatBytes from "../js/formatBytes.js"
import colors, { CHART_ACCENT, TOOLTIP_BG, TOOLTIP_BORDER, TOOLTIP_TEXT } from "../js/colors.js"

const ACCENT = CHART_ACCENT

const customTooltip = ({ active, payload }) => {
	if (active && payload && payload.length) {
		const name = payload[0].name == "Free Space" ? payload[0].name : `Camera ${payload[0].name}`
		const value = payload[0].dataKey == "size" ? formatBytes(payload[0].value, 2) : `${payload[0].value} image${payload[0].value > 1 ? "s" : ""}`
		return (
			<div style={{ backgroundColor: TOOLTIP_BG, color: TOOLTIP_TEXT, border: `1px solid ${TOOLTIP_BORDER}`, padding: "6px 10px", borderRadius: 6, fontSize: 13 }}>
				{`${name} : ${value}`}
			</div>
		)
	}
	return null
}

const segmentColor = (index) => index === 0 ? ACCENT : colors[(index) % colors.length]

const FileStatsPieChart = (props) => {
	const [rawCameras] = useCameras()

	const [state, setState, handleDelete, DeleteDialog] = useFileMetrics({
		loading: "refreshing",
		cameras: [],
		days: 7
	}, rawCameras)

	const sumSize = state.cameras.reduce((total, cam) => total + cam.size, 0)

	const pie = (
		<ResponsiveContainer>
			<PieChart style={{ background: "transparent" }}>
				{props.mobile ? null : <Tooltip content={customTooltip} />}
				<Pie
					data={state.cameras} dataKey="count" nameKey="number"
					cx="50%" cy="50%" innerRadius={37} outerRadius={55}
					onClick={handleDelete}
				>
					{state.cameras.map((entry, index) => (
						<Cell key={index} fill={segmentColor(index)} />
					))}
				</Pie>
				<Pie
					data={state.cameras} dataKey="size" nameKey="number"
					cx="50%" cy="50%" innerRadius={60} outerRadius={80}
					onClick={handleDelete}
					{...(props.mobile ? { label: ({ size, name }) => (size != 0 ? name : null) } : {})}
				>
					{state.cameras.map((entry, index) => (
						<Cell key={index} fill={segmentColor(index)} />
					))}
					<Label
						value={formatBytes(sumSize, 1)}
						position="center"
						style={{ fill: TOOLTIP_TEXT }}
						onClick={handleDelete}
					/>
				</Pie>
			</PieChart>
		</ResponsiveContainer>
	)

	if (props.withButton) {
		return (
			<Card className="h-full">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
					<NavigateToRoute to={"/stats"} />
				</CardHeader>
				<CardContent className="h-[50vh]">
					{pie}
					{DeleteDialog}
				</CardContent>
			</Card>
		)
	}

	return (
		<>
			{pie}
			{DeleteDialog}
		</>
	)
}

export default FileStatsPieChart
