import React from "react"
import useLoginSchema from "../hooks/useLoginSchema"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"

const LoginForm = (props) => {
	const [loginStatus, , , inputValues, onLoginEnter, updateUsername, updatePassword] = useLoginSchema(props)

	const handleKeyDown = (e) => {
		if (e.key === "Enter") onLoginEnter()
	}

	return (
		<Card className="w-80 bg-surface border-border">
			<CardHeader className="items-center gap-2 pb-2">
				<img src="/res/logo.png" alt="Chimera" className="h-12 w-12 object-contain" />
				<CardTitle className="text-primary text-xl">Chimera</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Label className="text-muted">Username</Label>
					<Input
						className="bg-surface-raised border-border text-primary placeholder:text-muted"
						placeholder="username"
						value={inputValues.username}
						onChange={updateUsername}
						onKeyDown={handleKeyDown}
						autoComplete="username"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<Label className="text-muted">Password</Label>
					<Input
						className="bg-surface-raised border-border text-primary placeholder:text-muted"
						type="password"
						placeholder="password"
						value={inputValues.password}
						onChange={updatePassword}
						onKeyDown={handleKeyDown}
						autoComplete="current-password"
					/>
				</div>
				{loginStatus === "wrong" && (
					<p className="text-danger text-sm">Invalid username or password.</p>
				)}
				{loginStatus === "right" && (
					<p className="text-accent text-sm">Signed in.</p>
				)}
				<Button
					className="bg-accent text-accent-foreground hover:opacity-90 w-full"
					onClick={onLoginEnter}
				>
					Sign In
				</Button>
			</CardContent>
		</Card>
	)
}

export default LoginForm
