const cameraInfo = (element, index) => {
	return {
		path: `shared/captures/${index + 1}`,
		number: index+1,
		name: element,
		size: 0,
		count: 0
	}
}

export default cameraInfo