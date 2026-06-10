import { useState } from "react"
import { request, jsonProcessing } from "../js/request.js"

const useClearFootage = (cameras, onDone) => {
	const [days, setDays] = useState(3)
	const [pending, setPending] = useState(null)
	const [deleting, setDeleting] = useState(false)

	const confirmDelete = () => {
		if (!pending) return
		setDeleting(true)
		setPending(null)

		const deleteCamera = (camId) => new Promise(resolve =>
			request("/file/pathClean", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ camera: camId, days })
			}, prom => jsonProcessing(prom, resolve))
		)

		const targets = pending.type === "all" ? cameras : [{ id: pending.cameraId }]
		Promise.all(targets.map(cam => deleteCamera(cam.id))).then(() => {
			setDeleting(false)
			onDone()
		})
	}

	return { days, setDays, pending, setPending, deleting, confirmDelete }
}

export default useClearFootage
