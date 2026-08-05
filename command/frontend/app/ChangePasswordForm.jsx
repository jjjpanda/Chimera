import React, { useId, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { validatePassword, PASSWORD_REQUIREMENT } from "../js/password.js"

const ChangePasswordForm = ({ changePassword }) => {
	const uid = useId()
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [status, setStatus] = useState(null)
	const [message, setMessage] = useState(null)

	const onSubmit = () => {
		if (!password || !confirm) {
			setStatus("failed")
			setMessage("Enter and confirm your new password.")
			return
		}
		if (password !== confirm) {
			setStatus("failed")
			setMessage("Passwords do not match.")
			return
		}
		const invalid = validatePassword(password)
		if (invalid) {
			setStatus("failed")
			setMessage(invalid)
			return
		}
		changePassword({ password }, (success, errors) => {
			setStatus(success ? "done" : "failed")
			setMessage(success ? null : errors)
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
						<Label htmlFor={`${uid}-password`} className="text-muted">New Password</Label>
						<Input
							id={`${uid}-password`}
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder="new password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
						<p className="text-muted text-xs">{PASSWORD_REQUIREMENT}</p>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-confirm`} className="text-muted">Confirm Password</Label>
						<Input
							id={`${uid}-confirm`}
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder="confirm password"
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
					</div>
					{status === "failed" && (
						<p role="alert" className="text-danger text-sm">{message || "Failed to change password."}</p>
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
