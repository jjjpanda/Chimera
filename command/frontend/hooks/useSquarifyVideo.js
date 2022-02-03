const getNumberOfRowsAndCols = (numberOfVideos) => {
	let i = 1
	for(/** */; i < 5; i++){
		if(numberOfVideos <= i ** 2){
			return i
		}
	}
	return i - 1
}

const squarifyVideoList = (videos) => {
	if(!videos){ 
		console.log("SQUARED", videos, [])
		return []
	}

	let numberOfVideos = videos.length
	if(numberOfVideos == 0){ 
		console.log("SQUARED", videos, [])
		return []
	}

	let numberOfRowsAndCols = getNumberOfRowsAndCols(numberOfVideos)

	let squaredVideoList = []
	let i = 0
	for (let j = 0; j < numberOfRowsAndCols; j++){
		squaredVideoList.push([])
		for (let k = 0; k < numberOfRowsAndCols; k++){
			if(i < numberOfVideos){
				squaredVideoList[j].push(videos[i])
				i++
			}
			else{
				squaredVideoList[j].push(null)
			}
		}
		if(i >= numberOfVideos){
			console.log("SQUARED", videos, squaredVideoList)
			return squaredVideoList
		}
	}
	console.log("SQUARED", videos, squaredVideoList)
	return squaredVideoList
}

const useSquarifyVideos = () => {
	return squarifyVideoList
}

export default useSquarifyVideos