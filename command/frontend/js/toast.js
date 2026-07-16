const toast = (message, ms = 2500) => {
	const id = Date.now() + Math.random()
	window.dispatchEvent(new CustomEvent("chimera-toast", { detail: { id, message, ms } }))
	return () => {
		window.dispatchEvent(new CustomEvent("chimera-toast-remove", { detail: { id } }))
	}
}

export default toast
