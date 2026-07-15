import moment from "moment"

const contentViewBox = (dims, pad = {}) => {
	const { top = 0, bot = 0, left = 0, right = 0 } = pad
	return `${left} ${top} ${dims.w - left - right} ${dims.h - top - bot}`
}

const nearestFrameIndex = (timesMs, targetMs) => {
	let bestIdx = 0, bestDiff = Infinity
	for (let i = 0; i < timesMs.length; i++) {
		const t = timesMs[i]
		if (t == null) continue
		const diff = Math.abs(t - targetMs)
		if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
	}
	return bestIdx
}

const frameSpacingMs = (timesMs) => {
	const valid = [...new Set(timesMs.filter(t => t != null))]
	if (valid.length <= 1) return Infinity
	return (Math.max(...valid) - Math.min(...valid)) / (valid.length - 1)
}

const boxesForScrub = (detections, frameMs, tol) => {
	if (frameMs == null) return []
	const at = (d) => moment(d.timestamp).valueOf()
	const here = detections.filter(d => {
		const v = at(d)
		return Number.isFinite(v) && Math.abs(v - frameMs) <= tol
	})
	if (!here.length) return []
	let best = here[0], bestDiff = Infinity
	for (const d of here) {
		const diff = Math.abs(at(d) - frameMs)
		if (diff < bestDiff) { bestDiff = diff; best = d }
	}
	return here.filter(d => d.image === best.image)
}

const fuseMarkers = (sortedPcts, fusePct) => {
	const out = []
	for (const p of sortedPcts) {
		const last = out[out.length - 1]
		if (last && p - last.end <= fusePct) last.end = p
		else out.push({ start: p, end: p })
	}
	return out
}

export { contentViewBox, nearestFrameIndex, frameSpacingMs, boxesForScrub, fuseMarkers }
