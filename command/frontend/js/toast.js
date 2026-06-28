const toast = (message, ms = 2500) => {
	window.dispatchEvent(new CustomEvent("chimera-toast", { detail: { message, ms } }))
	return () => {} // remove function stub for backwards compatibility
}

export default toast
