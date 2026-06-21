import React from "react"
import { Sun, Moon, Monitor } from "lucide-react"

import SideMenu from "./SideMenu"
import MobileView from "./MobileView"
import SignOutButton from "./SignOutButton.jsx"
import { useTheme } from "./ThemeContext.jsx"
import { cn } from "../lib/utils"

const themeOptions = [
	{ value: "light", icon: Sun },
	{ value: "dark", icon: Moon },
	{ value: "system", icon: Monitor },
]

const MobileMain = ({ index }) => {
	const { theme, applyTheme } = useTheme()

	return (
		<div className="min-h-screen bg-bg pb-24 pt-3 px-3">
			<header className="mb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<img src="/res/logo.png" alt="Chimera" className="size-7 object-contain" />
					<span className="text-base font-semibold tracking-tight">Chimera</span>
				</div>
				<div className="flex items-center rounded-md border border-border text-muted">
					<div className="flex">
						{themeOptions.map(({ value, icon: Icon }) => (
							<button
								key={value}
								aria-label={value}
								title={value}
								onClick={() => applyTheme(value)}
								className={cn(
									"flex items-center justify-center rounded-md px-2.5 py-1.5 transition-colors",
									theme === value ? "bg-accent/15 text-accent" : "hover:text-primary"
								)}
							>
								<Icon className="size-4" />
							</button>
						))}
					</div>
					<div className="w-px self-stretch bg-border" />
					<SignOutButton className="flex items-center justify-center px-2.5 py-1.5 transition-colors hover:text-primary" iconOnly />
				</div>
			</header>
			<MobileView index={index} />
			<SideMenu mobile index={index} />
		</div>
	)
}

export default MobileMain
