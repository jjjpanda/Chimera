import React, { useEffect } from "react"
import useFileStats from "../hooks/useFileStats.js"
import useCameras from "../hooks/useCameras.js"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

import moment from "moment"
import formatBytes from "../js/formatBytes.js"
import colors from "../js/colors.js"

const ACCENT = "#C97B3A"
const MUTED = "#9A7A6A"
const TOOLTIP_BG = "#3D1A0A"
const TOOLTIP_BORDER = "#4A2510"
const TOOLTIP_TEXT = "#F5EDE3"

const customTooltip = ({ active, payload }) => {
	if (active && payload && payload.length) {
		const timestamp = payload[0].payload ? payload[0].payload.timestamp : null
		return (
			<div style={{ backgroundColor: TOOLTIP_BG, color: TOOLTIP_TEXT, border: `1px solid ${TOOLTIP_BORDER}`, padding: "8px 12px", borderRadius: 6, fontSize: 13 }}>
				<div style={{ marginBottom: 4 }}>{timestamp ? moment(timestamp).format("MM/DD HH:00") : null}</div>
				{payload.map((item, index) => (
					<div key={index}>{`${item.name} : ${item.value == 0 ? "-" : formatBytes(item.value, 2)}`}</div>
				))}
			</div>
		)
	}
	return null
}

const segmentColor = (index) => index === 0 ? ACCENT : colors[index % colors.length]

const FileStatsLineChart = (props) => {
	const [rawCameras] = useCameras()

	const camerasInit = rawCameras.map((cam) => ({
		path: `shared/captures/${cam.id}`,
		number: cam.id,
		name: cam.name,
		size: 0,
		count: 0
	}))

	const [state, setState] = useFileStats({
		loading: "refreshing",
		cameras: camerasInit,
		days: 7,
		lastUpdated: moment().format("h:mm:ss a"),
		fileStats: [],
		hide: rawCameras.reduce((obj, cam) => ({ ...obj, [cam.name]: false }), {})
	})

	useEffect(() => {
		if (!rawCameras.length) return
		setState((s) => ({
			...s,
			cameras: rawCameras.map((cam) => ({
				path: `shared/captures/${cam.id}`,
				number: cam.id,
				name: cam.name,
				size: 0,
				count: 0
			})),
			hide: rawCameras.reduce((obj, cam) => ({ ...obj, [cam.name]: s.hide[cam.name] ?? false }), {})
		}))
	}, [rawCameras])

	const legendHandler = ({ payload }) => {
		const { dataKey } = payload
		if (dataKey != undefined) {
			setState((oldState) => {
				let { hide } = oldState
				hide[dataKey] = !oldState.hide[dataKey]
				return { ...oldState, hide, lastUpdated: moment().format("h:mm:ss a") }
			})
		}
	}

	const chart = (
		<ResponsiveContainer key={`LINE-CHART-${state.lastUpdated}`}>
			<LineChart
				data={props.mobile ? state.fileStats.slice(state.fileStats.length - 3, state.fileStats.length) : state.fileStats}
				style={{ background: "transparent" }}
			>
				<Tooltip content={customTooltip} />
				<XAxis
					dataKey="timestamp"
					domain={["auto", "auto"]}
					tickFormatter={unixTime => moment(unixTime).format("MM/DD")}
					type="number"
					tick={{ fill: MUTED, fontSize: 12 }}
					axisLine={{ stroke: MUTED }}
					tickLine={{ stroke: MUTED }}
				/>
				<YAxis
					tickFormatter={bytes => formatBytes(bytes, 2)}
					tick={{ fill: MUTED, fontSize: 12 }}
					axisLine={{ stroke: MUTED }}
					tickLine={{ stroke: MUTED }}
				/>
				<Legend onClick={legendHandler} layout="horizontal" align="right" verticalAlign="top" wrapperStyle={{ color: MUTED, fontSize: 12 }} />
				{state.cameras.map(({ name }, index) => (
					<Line key={name} hide={state.hide[name]} type="monotone" dataKey={name} dot={false} stroke={segmentColor(index)} />
				))}
			</LineChart>
		</ResponsiveContainer>
	)

	if (props.withButton) {
		return (
			<Card className="h-full">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium">Storage History</CardTitle>
				</CardHeader>
				<CardContent className="h-[50vh]">
					{chart}
				</CardContent>
			</Card>
		)
	}

	return chart
}

export default FileStatsLineChart
