const routeToIndex = (r) => {
	switch(r){
		case "live":
			return "route-1"
		case "process":
			return "route-2"
		case "scrub":
			return "route-3"
		case "stats":
			return "route-4"
		default: 
			return "route-0"
	}
}

const indexToRoute = (i) => {
	switch(i){
		case "route-1":
			return "/live"
		case "route-2":
			return "/process"
		case "route-3":
			return "/scrub"
		case "route-4":
			return "/stats"
		default: 
			return "/"
	}
}

export {routeToIndex, indexToRoute}