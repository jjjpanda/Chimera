module.exports = {
	list: (callback) => {
		callback(null, [{
			name: "motion",
			pm2_env: {
				status: "on",
				unstable_restarts: 0
			}
		}])
	},
	restart: jest.fn((name, cb) => cb(null))
}