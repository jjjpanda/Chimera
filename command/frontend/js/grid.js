const padSlots = (arr, n = 4) => Array.from({ length: n }, (_, i) => arr[i] ?? null)

export { padSlots }
