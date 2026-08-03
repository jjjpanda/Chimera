import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { useChangePassword } from "./AuthContext.jsx"
import { validatePassword, PASSWORD_REQUIREMENT } from "../js/password.js"
import toast from "../js/toast.js"

const emptyForm = { currentPassword: "", password: "", confirm: "" }

const AccountSettings = () => {
	const changePassword = useChangePassword()
	const [form, setForm] = useState(emptyForm)
	const [pending, setPending] = useState(false)

	const submit = (e) => {
		e.preventDefault()
		if (pending) return
		if (!form.currentPassword) return toast("Enter your current password")
		if (form.password !== form.confirm) return toast("Passwords do not match")
		const invalid = validatePassword(form.password)
		if (invalid) return toast(invalid)
		setPending(true)
		changePassword({ password: form.password, currentPassword: form.currentPassword }, (success, errors) => {
			setPending(false)
			if (!success) return toast(errors || "Failed to change password")
			setForm(emptyForm)
			toast("Password changed")
		})
	}

	const field = (key, label, placeholder, autoComplete) => (
		<div className="flex flex-col gap-1">
			<Label className="text-primary">{label}</Label>
			<Input
				type="password"
				value={form[key]}
				onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
				className="bg-surface-raised border-border text-primary placeholder:text-muted"
				placeholder={placeholder}
				autoComplete={autoComplete}
			/>
		</div>
	)

	return (
		<Card className="max-w-md">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">Change Password</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit} className="flex flex-col gap-4 pt-2">
					{field("currentPassword", "Current Password", "current password", "current-password")}
					{field("password", "New Password", "new password", "new-password")}
					<p className="text-xs text-muted -mt-3">{PASSWORD_REQUIREMENT}</p>
					{field("confirm", "Confirm Password", "re-enter new password", "new-password")}
					<p className="text-xs text-muted">Changing your password signs you out of every other session.</p>
					<Button type="submit" disabled={pending} className="self-start bg-accent text-accent-foreground hover:bg-accent/80">Change Password</Button>
				</form>
			</CardContent>
		</Card>
	)
}

export default AccountSettings
