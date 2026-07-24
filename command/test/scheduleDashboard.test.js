const { taskIdKey } = require("../frontend/app/ScheduleDashboard.jsx")

test("stays the same across a silent poll that changes nothing", () => {
	const before = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	const after = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	expect(after).toBe(before)
})

test("changes when a task's running state flips, even though the id set is unchanged", () => {
	const before = taskIdKey([{ id: 1, running: true }])
	const after = taskIdKey([{ id: 1, running: false }])
	expect(after).not.toBe(before)
})

test("changes when the id set changes", () => {
	const before = taskIdKey([{ id: 1, running: true }])
	const after = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	expect(after).not.toBe(before)
})
