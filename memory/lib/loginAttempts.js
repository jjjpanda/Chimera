module.exports = () => {
	const hits = new Map()
	const MAX_KEYS = 20000
	const prune = (now) => {
		if(hits.size > 5000) for(const [k, v] of hits) if(now > v.reset) hits.delete(k)
		if(hits.size > MAX_KEYS){
			const target = MAX_KEYS - (MAX_KEYS >> 3)
			for(const k of hits.keys()){
				if(hits.size <= target) break
				hits.delete(k)
			}
		}
	}
	return {
		loginReserve: (key, max, windowMs, callback=()=>{}) => {
			const now = Date.now()
			prune(now)
			const entry = hits.get(key)
			if(entry && now <= entry.reset && entry.count >= max) return callback(true)
			if(!entry || now > entry.reset) hits.set(key, { count: 1, reset: now + windowMs, max })
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
