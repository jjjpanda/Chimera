const padSlots = (arr, n = 4) => Array.from({ length: n }, (_, i) => arr[i] ?? null)

const gridShape = (n) => {
	const cols = n <= 1 ? 1 : 2
	return { cols, rows: Math.max(1, Math.ceil(n / cols)) }
}

export { padSlots, gridShape }
