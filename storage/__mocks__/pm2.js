module.exports = {
	list: (callback) => {
		callback(null, [{
			name: "motion",
			pm2_env: {
				status: "online",
				restart_time: 0
			}
		}])
	},
	restart: jest.fn((name, cb) => cb(null))
}