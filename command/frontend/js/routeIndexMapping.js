const routeToIndex = (r) => {
	switch (r) {
	case "clip":       return "route-1"
	case "live":       return "route-2"
	case "recordings": return "route-3"
	case "stats":      return "route-4"
	case "schedule":   return "route-5"
	case "admin":      return "route-6"
	default:           return "route-0"
	}
}

const indexToRoute = (i) => {
	switch (i) {
	case "route-1": return "/clip"
	case "route-2": return "/live"
	case "route-3": return "/recordings"
	case "route-4": return "/stats"
	case "route-5": return "/schedule"
	case "route-6": return "/admin"
	default:        return "/"
	}
}

export { routeToIndex, indexToRoute }
