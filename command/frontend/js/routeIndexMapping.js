const routeToIndex = (r) => {
	switch(r){
	case "live":
		return "route-1"
	case "scrub":
		return "route-2"
	case "stats":
		return "route-3"
	case "schedule":
		return "route-4"
	case "admin":
		return "route-5"
	case "data":
		return "route-6"
	default:
		return "route-0"
	}
}

const indexToRoute = (i) => {
	switch(i){
	case "route-1":
		return "/live"
	case "route-2":
		return "/scrub"
	case "route-3":
		return "/stats"
	case "route-4":
		return "/schedule"
	case "route-5":
		return "/admin"
	case "route-6":
		return "/data"
	default:
		return "/"
	}
}

export {routeToIndex, indexToRoute}
