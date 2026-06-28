import React, { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { request } from "../js/request.js"
import toast from "../js/toast.js"
import { validatePassword } from "../js/password.js"

const ROLES = ["user", "admin"]

const EditUserDialog = ({ user, open, onOpenChange, onUpdated }) => {
	const [form, setForm] = useState({ role: "", password: "", confirm: "" })

	useEffect(() => {
		if (user) setForm({ role: user.role, password: "", confirm: "" })
	}, [user])

	const updateUser = (e) => {
		e.preventDefault()
		if (form.password) {
			if (form.password !== form.confirm) return toast("Passwords do not match")
			const invalid = validatePassword(form.password)
			if (invalid) return toast(invalid)
		}
		const body = {}
		if (form.role) body.role = form.role
		if (form.password) body.password = form.password
		request(`/authorization/users/${encodeURIComponent(user.username)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		}, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
			if (res.error) {
				toast(res.errors || "Failed to update user")
			} else {
				toast("User updated")
				onOpenChange(false)
				if (onUpdated) onUpdated()
			}
		})
	}

	if (!user) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-surface-raised border-border text-primary">
				<DialogHeader>
					<DialogTitle className="text-primary">Edit User: {user.username}</DialogTitle>
				</DialogHeader>
				<form onSubmit={updateUser} className="flex flex-col gap-4 pt-2">
					<div className="flex flex-col gap-1">
						<Label className="text-primary">Role</Label>
						<Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
							<SelectTrigger className="bg-surface-raised border-border text-primary">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-surface-raised border-border text-primary">
								{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1">
						<Label className="text-primary">New Password</Label>
						<Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-surface-raised border-border text-primary placeholder:text-muted" placeholder="leave blank to keep current" />
					</div>
					<div className="flex flex-col gap-1">
						<Label className="text-primary">Confirm Password</Label>
						<Input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className="bg-surface-raised border-border text-primary placeholder:text-muted" placeholder="re-enter new password" />
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="ghost" className="text-muted hover:text-primary">Cancel</Button>
						</DialogClose>
						<Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/80">Save</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

export default EditUserDialog
