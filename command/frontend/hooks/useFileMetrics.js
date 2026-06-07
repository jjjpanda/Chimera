import React, { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"

import moment from "moment"
import { request, jsonProcessing } from "../js/request.js"

const cameraUpdate = (setState) => {
	setState((oldState) => ({
		...oldState,
		loading: "refreshing",
		lastUpdated: moment().format("h:mm:ss a")
	}))
	request("/file/pathMetrics", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if (data && "count" in data && "size" in data) {
				setState((oldState) => ({
					...oldState,
					cameras: oldState.cameras.map((camera) => ({
						...camera,
						size: parseInt(data.size[camera.name]),
						count: parseInt(data.count[camera.name])
					})),
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			} else {
				setState((oldState) => ({
					...oldState,
					lastUpdated: moment().format("h:mm:ss a"),
					loading: undefined
				}))
			}
		})
	})
}

const deleteFiles = (state, setState, camera = undefined) => {
	setState((oldState) => ({
		...oldState,
		loading: "deleting"
	}))
	if (camera != undefined) {
		request("/file/pathClean", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				camera,
				days: state.days
			})
		}, (prom) => {
			jsonProcessing(prom, () => {
				cameraUpdate(setState)
			})
		})
	} else {
		Promise.all(state.cameras.map((cam) => {
			return new Promise((resolve) => {
				request("/file/pathClean", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						camera: cam.number,
						days: state.days
					})
				}, (prom) => {
					jsonProcessing(prom, () => {
						resolve()
					})
				})
			})
		})).then(() => cameraUpdate(setState))
	}
}

const useFileMetrics = (initialState, cameras = []) => {
	const [state, setState] = useState(initialState)
	const [dialog, setDialog] = useState({ open: false, name: null, number: null })

	useEffect(() => {
		if (!cameras.length) return
		setState((s) => ({
			...s,
			cameras: cameras.map((cam) => ({
				path: `shared/captures/${cam.id}`,
				number: cam.id,
				name: cam.name,
				size: 0,
				count: 0
			}))
		}))
		cameraUpdate(setState)
	}, [cameras])

	const handleDelete = ({ name, number }) => {
		setDialog({ open: true, name: name || null, number: number || null })
	}

	const confirmDelete = () => {
		setDialog((d) => ({ ...d, open: false }))
		deleteFiles(state, setState, dialog.number || undefined)
	}

	const DeleteDialog = (
		<Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{dialog.name && dialog.number
							? `Delete Files from Camera: ${dialog.name}?`
							: "Delete Files from All Cameras?"}
					</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="delete-days" className="text-primary">Delete files older than N days</Label>
					<Input
						id="delete-days"
						type="number"
						min={0}
						value={state.days}
						onChange={(e) => setState((oldState) => ({ ...oldState, days: Number(e.target.value) }))}
						className="w-32"
					/>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={() => setDialog((d) => ({ ...d, open: false }))}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={confirmDelete}>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)

	return [state, setState, handleDelete, DeleteDialog]
}

export default useFileMetrics
