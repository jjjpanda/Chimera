import React from "react"
import { useNavigate } from "react-router-dom"
import { Home, Video, Scissors, Rewind, Activity, CalendarClock, Users, ScanEye, Sun, Moon, Monitor } from "lucide-react"

import { indexToRoute } from "../js/routeIndexMapping"
import { useRole } from "./AuthContext.jsx"
import { useTheme } from "./ThemeContext.jsx"
import SignOutButton from "./SignOutButton.jsx"
import { cn } from "../lib/utils"

const SideMenu = ({ index, mobile }) => {
	const role = useRole()
	const navigate = useNavigate()
	const { theme, applyTheme } = useTheme()
	const themeOptions = [
		{ value: "light", icon: Sun },
		{ value: "dark", icon: Moon },
		{ value: "system", icon: Monitor },
	]

	const mobileTabs = [
		{ key: "route-1", icon: Scissors, title: "Clip" },
		{ key: "route-2", icon: Video, title: "Live" },
		{ key: "route-0", icon: Home, title: "Home" },
		{ key: "route-3", icon: Rewind, title: "Recordings" },
		{ key: "route-4", icon: Activity, title: "Stats" },
	]

	const desktopTabs = [
		{ key: "route-0", icon: Home, title: "Home" },
		{ key: "route-2", icon: Video, title: "Live" },
		{ key: "route-1", icon: Scissors, title: "Clip Maker" },
		{ key: "route-3", icon: Rewind, title: "Recordings" },
		{ key: "route-4", icon: Activity, title: "Stats" },
		{ key: "route-5", icon: CalendarClock, title: "Schedule" },
		{ key: "route-7", icon: ScanEye, title: "Objects" },
		...(role === "admin" ? [
			{ key: "route-6", icon: Users, title: "Admin" },
		] : [])
	]

	const go = (key) => {
		if (index !== key) navigate(indexToRoute(key))
	}

	if (mobile) {
		return (
			<nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface px-1 py-2">
				{mobileTabs.map(({ key, icon: Icon, title }) => {
					const active = index === key
					return (
						<button
							key={key}
							onClick={() => go(key)}
							className={cn(
								"flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-xs font-medium transition-colors",
								active ? "text-accent" : "text-muted hover:text-primary"
							)}
						>
							{key === "route-0"
						? <img src="/res/logo.png" alt="Home" className="size-6 object-contain" />
						: <Icon className="size-6" />
					}
							<span className="leading-none">{title}</span>
						</button>
					)
				})}
			</nav>
		)
	}

	return (
		<aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
			<div className="flex items-center gap-2 px-4 py-4">
				<img src="/res/logo.png" alt="Chimera" className="h-8 w-8 object-contain" />
				<span className="text-lg font-semibold tracking-tight">Chimera</span>
			</div>
			<nav className="flex-1 space-y-1 px-2">
				{desktopTabs.map(({ key, icon: Icon, title }) => {
					const active = index === key
					return (
						<button
							key={key}
							onClick={() => go(key)}
							className={cn(
								"flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
								active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-raised hover:text-primary"
							)}
						>
							<Icon className="size-5 shrink-0" />
							<span>{title}</span>
						</button>
					)
				})}
			</nav>
			<div className="px-2 py-3">
				<div className="flex items-center gap-2 rounded-md px-3 py-2 text-muted">
					<div className="flex rounded-md border border-border">
						{themeOptions.map(({ value, icon: Icon }) => (
							<button
								key={value}
								aria-label={value}
								onClick={() => applyTheme(value)}
								className={cn(
									"flex items-center justify-center px-2 py-1 transition-colors first:rounded-l-md last:rounded-r-md",
									theme === value ? "bg-accent/15 text-accent" : "hover:text-primary"
								)}
							>
								<Icon className="size-4" />
							</button>
						))}
					</div>
					<div className="mx-1 h-4 w-px bg-border" />
					<SignOutButton className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary" iconOnly={false} />
				</div>
			</div>
		</aside>
	)
}

export default SideMenu
