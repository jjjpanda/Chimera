const previewMaxHeight = (winW, winH, rows = 1) =>
	Math.min(winW * 9 / 16, winH * 2 / 3) / rows

const clampHeight = (startH, dy, maxH) =>
	Math.max(80, Math.min(maxH, startH + dy))

export { previewMaxHeight, clampHeight }
