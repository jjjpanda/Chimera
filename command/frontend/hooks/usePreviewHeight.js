import { useState } from "react"
import { previewMaxHeight, clampHeight } from "../js/previewHeight.js"

const usePreviewHeight = (initial, { rows = 1 } = {}) => {
	const [previewHeight, setPreviewHeight] = useState(initial)

	const startResizeDrag = (e) => {
		e.preventDefault()
		const el = e.currentTarget
		el.setPointerCapture(e.pointerId)
		const startY = e.clientY
		const startH = previewHeight
		const maxH = previewMaxHeight(window.innerWidth, window.innerHeight, rows)
		const move = (ev) => setPreviewHeight(clampHeight(startH, ev.clientY - startY, maxH))
		const up = () => {
			el.removeEventListener("pointermove", move)
			el.removeEventListener("pointerup", up)
		}
		el.addEventListener("pointermove", move)
		el.addEventListener("pointerup", up)
	}

	return [previewHeight, setPreviewHeight, startResizeDrag]
}

export default usePreviewHeight
