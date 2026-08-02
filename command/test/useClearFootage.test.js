/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => {
	const calls = []
	return {
		__calls: calls,
		request: (url, opts, cb) => {
			let resolve
			const promise = new Promise((res) => { resolve = res })
			calls.push({ url, opts, resolve })
			return cb(promise)
		}
	}
})

jest.mock("../frontend/js/toast.js", () => {
	const messages = []
	return {
		__esModule: true,
		__messages: messages,
		default: (message) => {
			messages.push(message)
			return () => {}
		}
	}
})

const { renderHook, act } = require("@testing-library/react")
const useClearFootage = require("../frontend/hooks/useClearFootage.js").default
const { __calls: calls } = require("../frontend/js/request.js")
const { __messages: messages } = require("../frontend/js/toast.js")

const cameras = [{ id: 1 }, { id: 2 }, { id: 3 }]

const respond = (body) => ({ text: () => body === undefined ? Promise.reject(new Error("network")) : Promise.resolve(JSON.stringify(body)) })

const clearAll = async (bodies) => {
	const { result } = renderHook(() => useClearFootage(cameras, () => {}))
	act(() => { result.current.setPending({ type: "all" }) })
	act(() => { result.current.confirmDelete() })
	await act(async () => {
		calls.forEach((call, i) => call.resolve(respond(bodies[i])))
		await new Promise((r) => setTimeout(r, 0))
	})
	return result
}

const lastToast = () => messages[messages.length - 1]

beforeEach(() => {
	calls.length = 0
	messages.length = 0
})

test("names the export when every camera deferred", async () => {
	await clearAll([{ deferred: true }, { deferred: true }, { deferred: true }])
	expect(lastToast()).toBe("Deferred — Export Running")
})

test("separates deferred cameras from deleted ones in a partial result", async () => {
	await clearAll([{ deleted: true }, { deferred: true }, { deferred: true }])
	expect(lastToast()).toBe("1/3 Deleted — 2 Deferred, Export Running")
})

test("distinguishes a deferred camera from a failed one when nothing was deleted", async () => {
	await clearAll([{ deferred: true }, { error: true }, undefined])
	expect(lastToast()).toBe("None Deleted — 1 Deferred, Export Running")
})

test("still reports a plain failure with no deferral noise", async () => {
	await clearAll([{ error: true }, undefined, { deleted: false }])
	expect(lastToast()).toBe("None Deleted")
})

test("reports a clean sweep when every camera deleted", async () => {
	await clearAll([{ deleted: true }, { deleted: true }, { deleted: true }])
	expect(lastToast()).toBe("Files Deleted")
})

test("counts a camera as deleted when its files were removed and only the orphan sweep deferred", async () => {
	await clearAll([{ deleted: true, deferred: true }, { deleted: true }, { deleted: true }])
	expect(lastToast()).toBe("Files Deleted")
})

test("clears the deleting flag and calls onDone once a deferred run settles", async () => {
	const onDone = jest.fn()
	const { result } = renderHook(() => useClearFootage(cameras, onDone))
	act(() => { result.current.setPending({ type: "all" }) })
	act(() => { result.current.confirmDelete() })
	expect(result.current.deleting).toBe(true)
	await act(async () => {
		calls.forEach((call) => call.resolve(respond({ deferred: true })))
		await new Promise((r) => setTimeout(r, 0))
	})
	expect(result.current.deleting).toBe(false)
	expect(onDone).toHaveBeenCalledTimes(1)
})
