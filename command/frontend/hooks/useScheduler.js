import { request, jsonProcessing } from "../js/request.js"

const useScheduler = () => {
	const scheduleTask = (url, body, cronString, onDone) => {
		request("/task/start", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url, body, cronString })
		}, (prom) => {
			jsonProcessing(prom, (data) => {
				if (onDone) onDone(data)
			})
		})
	}

	return [scheduleTask]
}

export default useScheduler
