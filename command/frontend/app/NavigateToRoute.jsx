import React from "react"
import { useNavigate } from "react-router-dom"
import { Maximize2 } from "lucide-react"

const NavigateToRoute = ({ to }) => {
	const navigate = useNavigate()

	return (
		<button
			type="button"
			onClick={() => navigate(to, { replace: true })}
			className="flex items-center justify-center size-9 rounded-md text-muted transition-colors hover:text-primary hover:bg-surface-raised"
		>
			<Maximize2 className="size-5" />
		</button>
	)
}

export default NavigateToRoute
