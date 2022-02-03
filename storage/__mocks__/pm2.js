module.exports = {
	list: (callback) => {
		callback(null, [{
			name: "motion",
			pm2_env: {
				status: "on",
				unstable_restarts: 0
			}
		}])
	}
}