module.exports = {
	list: (callback) => {
		callback(null, [1, 2, 3].map((i) => ({
			name: `live_stream_cam_${i}`,
			pm2_env: {
				status: "on",
				unstable_restarts: 0
			}
		})))
	}
}