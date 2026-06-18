module.exports = () => {
	const hits = new Map()
	return {
		loginCheck: (key, max, callback=()=>{}) => {
			const now = Date.now()
			if(hits.size > 5000) for(const [k, v] of hits) if(now > v.reset) hits.delete(k)
			const entry = hits.get(key)
			callback(!!entry && now <= entry.reset && entry.count >= max)
		},

		loginFailure: (key, windowMs, callback=()=>{}) => {
			const now = Date.now()
			const entry = hits.get(key)
			if(!entry || now > entry.reset) hits.set(key, { count: 1, reset: now + windowMs })
			else entry.count++
			callback()
		}
	}
}
