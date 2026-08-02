import React from "react"
import useLoginSchema from "../hooks/useLoginSchema"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"

const LoginForm = (props) => {
	const [loginStatus, , , inputValues, onLoginEnter, updateUsername, updatePassword, loginError] = useLoginSchema(props)

	const handleSubmit = (e) => {
		e.preventDefault()
		onLoginEnter()
	}

	return (
		<Card className="w-80 bg-surface border-border">
			<CardHeader className="items-center gap-2 pb-2">
				<img src="/res/logo.png" alt="Chimera" className="h-12 w-12 object-contain" />
				<CardTitle className="text-primary text-xl">Chimera</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<Label className="text-muted">Username</Label>
						<Input
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							placeholder="username"
							value={inputValues.username}
							onChange={updateUsername}
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
							autoComplete="current-password"
						/>
					</div>
					{loginStatus === "wrong" && (
						<p className="text-danger text-sm">{loginError || "Invalid username or password."}</p>
					)}
					{loginStatus === "right" && (
						<p className="text-accent text-sm">Signed in.</p>
					)}
					<Button
						type="submit"
						className="bg-accent text-accent-foreground hover:opacity-90 w-full"
					>
						Sign In
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}

export default LoginForm
