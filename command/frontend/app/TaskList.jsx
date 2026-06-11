import React from "react"
import useTasks from "../hooks/useTasks.js"
import { useRole } from "./AuthContext.jsx"
import NavigateToRoute from "./NavigateToRoute.jsx"

import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { RotateCcw, Square, Trash2, ArrowRight } from "lucide-react"

import moment from "moment"
import cronstrue from "cronstrue"
import cronParser from "cron-parser"

const nextRunSeconds = (cronString) => {
	try {
		return moment(cronParser.parseExpression(cronString).next().toString()).diff(moment(), "seconds")
	} catch (e) {
		return Number.MAX_SAFE_INTEGER
	}
}

const humanCron = (cronString) => {
	try {
		return cronstrue.toString(cronString)
	} catch (e) {
		return cronString || ""
	}
}

const TaskList = (props) => {
	const [state, restartTask, stopTask, deleteTask] = useTasks()
	const role = useRole()

	const processListSortedUpcoming = [...state.processList].sort((a, b) => nextRunSeconds(a.cronString) - nextRunSeconds(b.cronString))
	const processListSortedAll = [...state.processList].sort((a, b) => String(a.id).localeCompare(String(b.id)))

	const renderList = (items) => {
		if (state.loading) {
			return <p className="py-4 text-center text-sm text-muted">Loading…</p>
		}
		if (!items.length) {
			return <p className="py-4 text-center text-sm text-muted">No tasks</p>
		}
		return (
			<ul className="divide-y divide-border">
				{items.map((item) => (
					<li key={item.id} className="flex items-center gap-3 py-2">
						<ArrowRight className="size-3.5 shrink-0 text-muted" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm text-primary">{item.url}</p>
							<p className="text-xs text-muted">{humanCron(item.cronString)}</p>
						</div>
						{role === "admin" && (
							<div className="flex shrink-0 gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									onClick={() => item.running ? stopTask(item.id) : restartTask(item.id)}
								>
									{item.running
										? <Square className="size-3.5" />
										: <RotateCcw className="size-3.5" />
									}
								</Button>
								{item.id !== "task-auto-cleanup" && (
									<Button
										variant="ghost"
										size="icon"
										className="size-7 text-danger hover:text-danger"
										onClick={() => deleteTask(item.id)}
									>
										<Trash2 className="size-3.5" />
									</Button>
								)}
							</div>
						)}
					</li>
				))}
			</ul>
		)
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">Scheduled Tasks</CardTitle>
					{props.withButton && <NavigateToRoute to="/schedule" />}
				</div>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="upcoming">
					<TabsList className="mb-2 w-full">
						<TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
						<TabsTrigger value="all" className="flex-1">All</TabsTrigger>
					</TabsList>
					<TabsContent value="upcoming">{renderList(processListSortedUpcoming)}</TabsContent>
					<TabsContent value="all">{renderList(processListSortedAll)}</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	)
}

export default TaskList
