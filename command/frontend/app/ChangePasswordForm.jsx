import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"

const ChangePasswordForm = ({ changePassword }) => {
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [status, setStatus] = useState(null)

	const onSubmit = () => {
		if (!password || password !== confirm) {
			setStatus("mismatch")
			return
		}
		changePassword(password, (success) => {
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
					<CardTitle className="text-primary text-xl">Change Password</CardTitle>
					<p className="text-muted text-sm">You must set a new password to continue.</p>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<Label className="text-muted">New Password</Label>
						<Input
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder="new password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label className="text-muted">Confirm Password</Label>
						<Input
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder="confirm password"
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
					</div>
					{status === "mismatch" && (
						<p className="text-danger text-sm">Passwords do not match.</p>
					)}
					{status === "failed" && (
						<p className="text-danger text-sm">Failed to change password.</p>
					)}
					<Button
						className="bg-accent text-accent-foreground hover:opacity-90 w-full"
						onClick={onSubmit}
					>
						Set Password
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

export default ChangePasswordForm
