const services = ["command", "livestream", "object", "schedule", "storage"]

const enabledServices = () =>
	services.filter(
		name => process.env[`${name}_ON`] === "true"
			&& process.env[`${name}_PROXY_ON`] === "true"
	)

module.exports = { heartbeatServices: services, enabledServices }
