let cron, makeScheduledTasks, io, tasks, fakeTask
const taskObject = { id: "t1", cronString: "* * * * *", running: true }

beforeEach(() => {
	jest.resetModules()
	fakeTask = { start: jest.fn(), stop: jest.fn(), destroy: jest.fn() }
	jest.doMock("node-cron", () => ({ schedule: jest.fn(() => fakeTask) }))
	cron = require("node-cron")
	makeScheduledTasks = require("../lib/scheduledTasks.js")
	io = { emit: jest.fn() }
	tasks = makeScheduledTasks(io)
})

describe("memory scheduledTasks lifecycle", () => {
	test("createTask schedules, starts, and emits the task id on tick", () => {
		tasks.createTask(taskObject)
		expect(cron.schedule).toHaveBeenCalledWith(taskObject.cronString, expect.any(Function))
		expect(fakeTask.start).toHaveBeenCalledTimes(1)
		cron.schedule.mock.calls[0][1]()
		expect(io.emit).toHaveBeenCalledWith(taskObject.id)
	})

	test("stopTask pauses the task and flags running=false", () => {
		tasks.createTask(taskObject)
		let configs
		tasks.stopTask(taskObject.id, c => { configs = c })
		expect(fakeTask.stop).toHaveBeenCalledTimes(1)
		expect(configs[taskObject.id].running).toBe(false)
	})

	test("startTask resumes the task and flags running=true", () => {
		tasks.createTask(taskObject)
		let configs
		tasks.startTask(taskObject.id, c => { configs = c })
		expect(fakeTask.start).toHaveBeenCalledTimes(2)
		expect(configs[taskObject.id].running).toBe(true)
	})

	test("destroyTask destroys the node-cron task and drops its config", () => {
		tasks.createTask(taskObject)
		let configs
		tasks.destroyTask(taskObject.id, c => { configs = c })
		expect(fakeTask.destroy).toHaveBeenCalledTimes(1)
		expect(fakeTask.stop).not.toHaveBeenCalled()
		expect(configs[taskObject.id]).toBeUndefined()
	})

	test("createTask destroys the prior cron before replacing an existing id", () => {
		tasks.createTask(taskObject)
		const firstTask = fakeTask
		const secondTask = { start: jest.fn(), stop: jest.fn(), destroy: jest.fn() }
		cron.schedule.mockReturnValueOnce(secondTask)

		tasks.createTask({ ...taskObject, cronString: "*/5 * * * *" })

		expect(firstTask.destroy).toHaveBeenCalledTimes(1)
		let configs
		tasks.listTasks(c => { configs = c })
		expect(configs[taskObject.id].cronString).toBe("*/5 * * * *")
		expect(secondTask.start).toHaveBeenCalledTimes(1)
	})
})
