const toast = (message, ms = 2500) => {
	const el = document.createElement("div")
	el.textContent = message
	el.style.cssText = [
		"position:fixed", "left:50%", "bottom:24px", "transform:translateX(-50%)",
		"z-index:9999", "background:rgb(var(--color-surface-raised))", "color:rgb(var(--color-primary))", "border:1px solid rgb(var(--color-border))",
		"padding:10px 16px", "border-radius:8px", "font-family:Inter,sans-serif",
		"font-size:14px", "box-shadow:0 4px 16px rgba(0,0,0,.4)"
	].join(";")
	document.body.appendChild(el)
	const remove = () => el.remove()
	if (ms > 0) setTimeout(remove, ms)
	return remove
}

export default toast
