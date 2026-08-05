const processNames = [1, 2, 3].map((i) => `live_stream_cam_${i}`)

module.exports = {
	list: (callback) => {
		callback(null, processNames.map((name) => ({
			name,
			pm2_env: {
				status: "online",
				restart_time: 0
			}
		})))
	},

	restart: (processName, callback) => {
		if(!/^live_stream_cam_\d{1,8}$/.test(processName)) return callback(new Error("process or namespace not found"))
		callback(null, { name: processName })
	}
}