let provider = null

module.exports = {
	register: (p) => { provider = p },
	getConfig: () => provider ? provider.getConfig() : {},
	getStatus: () => provider ? provider.getStatus() : {},
	setConfig: (updates) => provider ? provider.setConfig(updates) : {}
}
