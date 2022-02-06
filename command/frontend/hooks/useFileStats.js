import {useEffect, useState} from "react"

import {request, jsonProcessing} from "../js/request.js"

const statsUpdate = (state, setState) => {
	request("/file/pathStats", {
		method: "GET"
	}, (prom) => {
		jsonProcessing(prom, (data) => {
			if(data != undefined){
				setState((oldState) => ({
					...oldState,
					fileStats: data,
				}))
			}
		})
	})
}

const useFileStats = (initialState) => {
	const [state, setState] = useState(initialState)

	useEffect(() => {
		statsUpdate(state, setState)
	}, [])

	return [state, setState]
}

export default useFileStats