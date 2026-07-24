import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { validatePassword } from "../js/password.js"

const SetupForm = ({ trySetup, tokenRequired }) => {
	const [status, setStatus] = useState(null)
	const [message, setMessage] = useState(null)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [token, setToken] = useState("")

	const onSubmit = (e) => {
		e.preventDefault()
		const invalid = validatePassword(password)
		if (invalid) {
			setStatus("failed")
			setMessage(invalid)
			return
		}
		if (password !== confirmPassword) {
			setStatus("failed")
			setMessage("Passwords do not match.")
			return
		}
		trySetup(username, password, tokenRequired ? token : undefined, (success, errors) => {
			setStatus(success ? "done" : "failed")
			setMessage(success ? null : errors)
		})
	}

	if (!tokenRequired) {
		return (
			<div className="min-h-screen bg-bg flex items-center justify-center">
				<Card className="w-80 bg-surface border-border">
					<CardHeader className="items-center gap-2 pb-2">
						<img src="/res/logo.png" alt="Chimera" className="h-12 w-12 object-contain" />
						<CardTitle className="text-primary text-xl">Chimera</CardTitle>
						<p className="text-muted text-sm">Setup unavailable</p>
					</CardHeader>
					<CardContent>
						<p className="text-muted text-sm">Set the <code>setup_TOKEN</code> environment variable to create the admin account.</p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-bg flex items-center justify-center">
			<Card className="w-80 bg-surface border-border">
				<CardHeader className="items-center gap-2 pb-2">
					<img src="/res/logo.png" alt="Chimera" className="h-12 w-12 object-contain" />
					<CardTitle className="text-primary text-xl">Chimera</CardTitle>
					<p className="text-muted text-sm">Create your account</p>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<Label className="text-muted">Username</Label>
							<Input
								className="bg-surface-raised border-border text-primary placeholder:text-muted"
								placeholder="username"
								value={username}
								onChange={e => setUsername(e.target.value)}
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
								autoComplete="new-password"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label className="text-muted">Confirm Password</Label>
							<Input
								className="bg-surface-raised border-border text-primary placeholder:text-muted"
								type="password"
								placeholder="confirm password"
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
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
								/>
							</div>
						)}
						{status === "failed" && (
							<p className="text-danger text-sm">{message || "Setup failed. Check your credentials."}</p>
						)}
						{status === "done" && (
							<p className="text-accent text-sm">Account created — redirecting to login…</p>
						)}
						<Button
							type="submit"
							className="bg-accent text-accent-foreground hover:opacity-90 w-full"
							disabled={status === "done"}
						>
							Create Account
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}

export default SetupForm
