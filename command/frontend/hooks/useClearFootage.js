import { useState } from "react"
import { request } from "../js/request.js"
import toast from "../js/toast.js"

const useClearFootage = (cameras, onDone) => {
	const [days, setDays] = useState(3)
	const [pending, setPending] = useState(null)
	const [deleting, setDeleting] = useState(false)

	const confirmDelete = () => {
		if (!pending) return
		setDeleting(true)
		setPending(null)
		const remove = toast("Attempting Delete…", 0)

		const deleteCamera = (camId) => request(days === 0 ? "/file/pathDelete" : "/file/pathClean", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(days === 0 ? { camera: camId } : { camera: camId, days })
		}, prom => prom
			.then(res => res.text())
			.then(text => { try { return JSON.parse(text) } catch { return text } })
			.catch(() => undefined)
		)

		const targets = pending.type === "all" ? cameras : [{ id: pending.cameraId }]
		Promise.all(targets.map(cam => deleteCamera(cam.id))).then((results) => {
			remove()
			const deleted = results.filter(r => r?.deleted).length
			const deferred = results.filter(r => r?.deferred && !r?.deleted).length
			const total = results.length
			const suffix = deferred ? ` — ${deferred} Deferred, Export Running` : ""
			const counted = deleted === 0 ? `None Deleted${suffix}` : deleted === total ? "Files Deleted" : `${deleted}/${total} Deleted${suffix}`
			toast(deferred && deferred === total ? "Deferred — Export Running" : counted)
			setDeleting(false)
			onDone()
		})
	}

	return { days, setDays, pending, setPending, deleting, confirmDelete }
}

export default useClearFootage
