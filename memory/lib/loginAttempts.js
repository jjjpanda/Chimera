module.exports = () => {
	const hits = new Map()
	const prune = (now) => { if(hits.size > 5000) for(const [k, v] of hits) if(now > v.reset) hits.delete(k) }
	return {
		loginReserve: (key, max, windowMs, callback=()=>{}) => {
			const now = Date.now()
			prune(now)
			const entry = hits.get(key)
			if(entry && now <= entry.reset && entry.count >= max) return callback(true)
			if(!entry || now > entry.reset) hits.set(key, { count: 1, reset: now + windowMs })
			else entry.count++
			callback(false)
		},

		loginRelease: (key, callback=()=>{}) => {
			const entry = hits.get(key)
			if(entry && entry.count > 0) entry.count--
			callback()
		}
	}
}
