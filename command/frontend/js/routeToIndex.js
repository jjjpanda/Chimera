const routeToIndex = (r) => {
	switch(r){
	case "":
		return 0
	case "live":
		return 1
	case "process":
		return 2
	case "scrub":
		return 3
	case "stats":
		return 4
	default: 
		return 0
	}
}

export default routeToIndex