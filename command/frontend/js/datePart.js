const num = (v) => {
	const n = parseInt(v, 10)
	return Number.isFinite(n) ? n : null
}

const applyDatePart = (prev, part, val) => {
	const next = prev.clone()
	if (part === "date") {
		const [y, m, d] = val.split("-").map(num)
		if (y === null || m === null || d === null) return null
		next.year(y).month(m - 1).date(d)
	} else {
		const [h, min, sec] = val.split(":")
		const [hh, mm] = [num(h), num(min)]
		if (hh === null || mm === null) return null
		next.hour(hh).minute(mm).second(sec ? num(sec) ?? 0 : 0)
	}
	return next.isValid() ? next : null
}

export default applyDatePart
