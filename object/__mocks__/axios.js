module.exports = {
	default: {
		create: () => ({
			post: (url, data) => {
				return new Promise(resolve => {
					resolve(data)
				})
			}
		})
	}
}
