import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"

const SetupForm = ({ trySetup, tokenRequired }) => {
	const [status, setStatus] = useState(null)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [token, setToken] = useState("")

	const onSubmit = () => {
		trySetup(username, password, tokenRequired ? token : undefined, (success) => {
			setStatus(success ? "done" : "failed")
		})
	}

	const handleKeyDown = (e) => {
		if (e.key === "Enter") onSubmit()
	}

	return (
		<div className="min-h-screen bg-bg flex items-center justify-center">
			<Card className="w-80 bg-surface border-border">
				<CardHeader className="items-center gap-2 pb-2">
					<img src="/res/logo.png" alt="Chimera" className="h-12 w-12 object-contain" />
					<CardTitle className="text-primary text-xl">Chimera</CardTitle>
					<p className="text-muted text-sm">Create your account</p>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<Label className="text-muted">Username</Label>
						<Input
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							placeholder="username"
							value={username}
							onChange={e => setUsername(e.target.value)}
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
							value={password}
							onChange={e => setPassword(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
					</div>
					{tokenRequired && (
						<div className="flex flex-col gap-1">
							<Label className="text-muted">Setup Token</Label>
							<Input
								className="bg-surface-raised border-border text-primary placeholder:text-muted"
								type="password"
								placeholder="setup token"
								value={token}
								onChange={e => setToken(e.target.value)}
								onKeyDown={handleKeyDown}
							/>
						</div>
					)}
					{status === "failed" && (
						<p className="text-danger text-sm">Setup failed. Check your credentials.</p>
					)}
					<Button
						className="bg-accent text-accent-foreground hover:opacity-90 w-full"
						onClick={onSubmit}
					>
						Create Account
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

export default SetupForm
