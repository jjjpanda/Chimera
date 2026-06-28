import React, { useState } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { request } from "../js/request.js"
import toast from "../js/toast.js"

const ROLES = ["user", "admin"]

const AddUserDialog = ({ onAdded }) => {
	const [open, setOpen] = useState(false)
	const [form, setForm] = useState({ username: "", role: "user" })
	const [tempPassword, setTempPassword] = useState(null)
	const [copied, setCopied] = useState(false)

	const addUser = (e) => {
		e.preventDefault()
		request("/authorization/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(form)
		}, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
			if (res.error) {
				toast(res.errors || "Failed to add user")
			} else {
				setTempPassword(res.tempPassword)
				setForm({ username: "", role: "user" })
				if (onAdded) onAdded()
			}
		})
	}

	const copyPassword = () => {
		const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
		const fallback = () => {
			const el = document.createElement("textarea")
			el.value = tempPassword
			el.readOnly = false
			el.contentEditable = "true"
			el.style.position = "fixed"
			el.style.top = "0"
			el.style.left = "0"
			el.style.opacity = "0"
			document.body.appendChild(el)
			el.select()
			try { document.execCommand("copy") } catch { /* ignore */ }
			document.body.removeChild(el)
			markCopied()
		}
		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(tempPassword).then(markCopied).catch(fallback)
		} else {
			fallback()
		}
	}

	return (
		<Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setTempPassword(null); setCopied(false) } }}>
			<DialogTrigger asChild>
				<Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/80">Add User</Button>
			</DialogTrigger>
			<DialogContent className="bg-surface-raised border-border text-primary">
				<DialogHeader>
					<DialogTitle className="text-primary">Add User</DialogTitle>
					<DialogDescription className="text-muted">A temporary password will be generated for the user to change on first login.</DialogDescription>
				</DialogHeader>
				{tempPassword ? (
					<div className="flex flex-col gap-4 pt-2">
						<p className="text-sm text-muted">User created. Share this temporary password with them:</p>
						<div className="flex items-center gap-2">
							<code className="flex-1 rounded bg-surface border border-border px-3 py-2 text-sm text-primary font-mono break-all">{tempPassword}</code>
							<Button size="sm" variant="outline" className="border-border text-primary hover:bg-surface-raised shrink-0" onClick={copyPassword}>{copied ? "Copied!" : "Copy"}</Button>
						</div>
						<DialogFooter>
							<DialogClose asChild>
								<Button className="bg-accent text-accent-foreground hover:bg-accent/80" onClick={() => setTempPassword(null)}>Done</Button>
							</DialogClose>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={addUser} className="flex flex-col gap-4 pt-2">
						<div className="flex flex-col gap-1">
							<Label className="text-primary">Username</Label>
							<Input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="bg-surface-raised border-border text-primary placeholder:text-muted" placeholder="username" />
						</div>
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
						<DialogFooter>
							<DialogClose asChild>
								<Button type="button" variant="ghost" className="text-muted hover:text-primary">Cancel</Button>
							</DialogClose>
							<Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/80">Add</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	)
}

export default AddUserDialog
