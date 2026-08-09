module.exports = () => {
	const hits = new Map()
	const MAX_KEYS = 20000
	// Eviction order decides who wins a flood. Sorting by reset dropped every short-window key
	// first, which is exactly the 15-minute per-account counter sitting at its max, while the
	// 24h day counters were never touched. Order by what an eviction gives back instead: a
	// counter at its max is the one doing the blocking, so it goes last. Three passes over the
	// map, no copy and no sort, because this runs inside the login request.
	const prune = (now) => {
		if(hits.size > 5000) for(const [k, v] of hits) if(now > v.reset) hits.delete(k)
		if(hits.size <= MAX_KEYS) return
		const target = MAX_KEYS - (MAX_KEYS >> 3)
		const sweep = (evictable) => {
			for(const [k, v] of hits){
				if(hits.size <= target) return
				if(evictable(v)) hits.delete(k)
			}
		}
		sweep((v) => v.count <= 1 && v.count < v.max)
		sweep((v) => v.count < v.max)
		sweep(() => true)
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
