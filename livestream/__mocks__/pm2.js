const processNames = [1, 2, 3].map((i) => `live_stream_cam_${i}`)

module.exports = {
	list: (callback) => {
		callback(null, processNames.map((name) => ({
			name,
			pm2_env: {
				status: "on",
				unstable_restarts: 0
			}
		})))
	},

	restart: (processName, callback) => {
		if(!processNames.includes(processName)) return callback(new Error("process or namespace not found"))
		callback(null, { name: processName })
	}
}