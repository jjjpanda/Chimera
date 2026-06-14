import React from "react"
import { useNavigate } from "react-router-dom"
import { Maximize2 } from "lucide-react"

const NavigateToRoute = ({ to }) => {
	const navigate = useNavigate()

	return (
		<button
			type="button"
			onClick={() => navigate(to, { replace: true })}
			className="text-muted transition-colors hover:text-primary"
		>
			<Maximize2 className="size-4" />
		</button>
	)
}

export default NavigateToRoute
