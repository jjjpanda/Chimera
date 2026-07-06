const GRAY = 114  // ffmpeg letterbox color component value (0x727272)
const GRAY_TOL = 20

const detectGrayPad = (img) => {
	const { naturalWidth: w, naturalHeight: h } = img
	const out = { top: 0, bot: 0, left: 0, right: 0 }
	if (!w || !h) return out
	try {
		const canvas = document.createElement("canvas")
		canvas.width = w; canvas.height = h
		const ctx = canvas.getContext("2d")
		ctx.drawImage(img, 0, 0)
		const isGray = (data) => {
			for (let i = 0; i < data.length; i += 4)
				if (Math.abs(data[i] - GRAY) > GRAY_TOL || Math.abs(data[i + 1] - GRAY) > GRAY_TOL || Math.abs(data[i + 2] - GRAY) > GRAY_TOL) return false
			return true
		}
		while (out.top < h / 2 && isGray(ctx.getImageData(0, out.top, w, 1).data)) out.top++
		while (out.bot < h / 2 && isGray(ctx.getImageData(0, h - 1 - out.bot, w, 1).data)) out.bot++
		while (out.left < w / 2 && isGray(ctx.getImageData(out.left, 0, 1, h).data)) out.left++
		while (out.right < w / 2 && isGray(ctx.getImageData(w - 1 - out.right, 0, 1, h).data)) out.right++
		return out
	} catch {
		return out
	}
}

export { GRAY, GRAY_TOL, detectGrayPad }
