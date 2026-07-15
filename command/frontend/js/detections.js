const contentViewBox = (dims, pad = {}) => {
	const { top = 0, bot = 0, left = 0, right = 0 } = pad
	return `${left} ${top} ${dims.w - left - right} ${dims.h - top - bot}`
}

export { contentViewBox }
