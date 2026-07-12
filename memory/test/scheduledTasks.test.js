let cron, makeScheduledTasks, io, tasks, fakeTask, taskObject

beforeEach(() => {
	jest.resetModules()
	taskObject = { id: "t1", cronString: "* * * * *", running: true }
	fakeTask = { start: jest.fn(), stop: jest.fn(), destroy: jest.fn() }
	jest.doMock("node-cron", () => ({ createTask: jest.fn(() => fakeTask) }))
	cron = require("node-cron")
	makeScheduledTasks = require("../lib/scheduledTasks.js")
	io = { emit: jest.fn() }
	tasks = makeScheduledTasks(io)
})

describe("memory scheduledTasks lifecycle", () => {
	test("createTask schedules, starts, and broadcasts the live task config on tick", () => {
		tasks.createTask(taskObject)
		expect(cron.createTask).toHaveBeenCalledWith(taskObject.cronString, expect.any(Function))
		expect(fakeTask.start).toHaveBeenCalledTimes(1)

		const updatedTask = { ...taskObject, body: "NEW" }
		tasks.createTask(updatedTask)

		cron.createTask.mock.calls[0][1]()
		expect(io.emit).toHaveBeenCalledWith("runTask", updatedTask)
	})

	test("createTask does not start the cron when running is false", () => {
		tasks.createTask({ ...taskObject, running: false })
		expect(fakeTask.start).not.toHaveBeenCalled()
	})

	test("a tick that fires after the task was destroyed emits nothing", () => {
		tasks.createTask(taskObject)
		tasks.destroyTask(taskObject.id)
		cron.createTask.mock.calls[0][1]()
		expect(io.emit).not.toHaveBeenCalled()
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
		cron.createTask.mockReturnValueOnce(secondTask)

		tasks.createTask({ ...taskObject, cronString: "*/5 * * * *" })

		expect(firstTask.destroy).toHaveBeenCalledTimes(1)
		let configs
		tasks.listTasks(c => { configs = c })
		expect(configs[taskObject.id].cronString).toBe("*/5 * * * *")
		expect(secondTask.start).toHaveBeenCalledTimes(1)
	})
})
