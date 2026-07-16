import React, { useState, useEffect } from "react"

export default function ToastContainer() {
	const [toasts, setToasts] = useState([])

	useEffect(() => {
		const handleToast = (e) => {
			const { id, message, ms } = e.detail
			setToasts(t => [...t, { id, message }])
			if (ms > 0) {
				setTimeout(() => {
					setToasts(t => t.filter(toast => toast.id !== id))
				}, ms)
			}
		}
		const handleRemove = (e) => {
			const { id } = e.detail
			setToasts(t => t.filter(toast => toast.id !== id))
		}
		window.addEventListener("chimera-toast", handleToast)
		window.addEventListener("chimera-toast-remove", handleRemove)
		return () => {
			window.removeEventListener("chimera-toast", handleToast)
			window.removeEventListener("chimera-toast-remove", handleRemove)
		}
	}, [])

	if (toasts.length === 0) return null

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
			{toasts.map(t => (
				<div key={t.id} className="bg-surface-raised text-primary border border-border px-4 py-2.5 rounded-lg font-sans text-sm shadow-[0_4px_16px_rgba(0,0,0,0.4)] whitespace-nowrap pointer-events-auto">
					{t.message}
				</div>
			))}
		</div>
	)
}
