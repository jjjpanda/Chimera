module.exports = (emit = () => {}, overrides = {}) => ({
	emit,
	on: () => {},
	off: () => {},
	connected: false,
	timeout: () => ({
		emit: (event, ...args) => {
			const ack = args[args.length - 1]
			if (typeof ack != "function") return emit(event, ...args)
			return emit(event, ...args.slice(0, -1), (...result) => ack(null, ...result))
		}
	}),
	...overrides
})
