import React, { useState, useEffect } from "react"
import moment from "moment"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { request } from "../js/request.js"
import toast from "../js/toast.js"
import NavigateToRoute from "./NavigateToRoute.jsx"

const ROLES = ["user", "admin"]

const AdminPanel = ({ withButton } = {}) => {
	const [users, setUsers] = useState([])
	const [loading, setLoading] = useState(false)
	const [addOpen, setAddOpen] = useState(false)
	const [addForm, setAddForm] = useState({ username: "", role: "user" })
	const [tempPassword, setTempPassword] = useState(null)
	const [copied, setCopied] = useState(false)
	const [editTarget, setEditTarget] = useState(null)
	const [editForm, setEditForm] = useState({ role: "", password: "" })
	const [deleteTarget, setDeleteTarget] = useState(null)
	const [expandedSessions, setExpandedSessions] = useState({})
	const [sessions, setSessions] = useState({})

	const fetchUsers = () => {
		setLoading(true)
		request("/authorization/users", { method: "GET" }, p => p.then(r => r.json()).catch(() => ({ error: true })))
			.then(data => {
				if (!data.error) setUsers(data)
				setLoading(false)
			})
	}

	useEffect(() => { fetchUsers() }, [])

	const addUser = (e) => {
		e.preventDefault()
		request("/authorization/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(addForm)
		}, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
			if (res.error) {
				toast("Failed to add user")
			} else {
				setTempPassword(res.tempPassword)
				setAddForm({ username: "", role: "user" })
				fetchUsers()
			}
		})
	}

	const updateUser = (e) => {
		e.preventDefault()
		const body = {}
		if (editForm.role) body.role = editForm.role
		if (editForm.password) body.password = editForm.password
		request(`/authorization/users/update/${encodeURIComponent(editTarget.username)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		}, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
			if (res.error) {
				toast("Failed to update user")
			} else {
				toast("User updated")
				setEditTarget(null)
				fetchUsers()
			}
		})
	}

	const toggleSessions = (username) => {
		if (expandedSessions[username]) {
			setExpandedSessions(s => ({ ...s, [username]: false }))
			return
		}
		setExpandedSessions(s => ({ ...s, [username]: true }))
		request(`/authorization/users/${encodeURIComponent(username)}/sessions`, { method: "GET" }, p => p.then(r => r.json()).catch(() => ({ error: true })))
			.then(data => {
				if (!data.error) setSessions(s => ({ ...s, [username]: data }))
			})
	}

	const revokeSession = (username, id) => {
		request(`/authorization/sessions/${id}`, { method: "DELETE" }, p => p.then(r => r.json()).catch(() => ({ error: true })))
			.then(res => {
				if (res.error) {
					toast("Failed to revoke session")
				} else {
					toast("Session revoked")
					setSessions(s => ({
						...s,
						[username]: (s[username] || []).map(sess => sess.id === id ? { ...sess, revoked: true } : sess)
					}))
				}
			})
	}

	const deleteUser = () => {
		request(`/authorization/users/${encodeURIComponent(deleteTarget.username)}`, {
			method: "DELETE"
		}, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
			if (res.error) {
				toast("Cannot delete user")
			} else {
				toast("User deleted")
				setDeleteTarget(null)
				fetchUsers()
			}
		})
	}

	const copyPassword = () => {
		const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
		const fallback = () => {
			const el = document.createElement("textarea")
			el.value = tempPassword
			document.body.appendChild(el)
			el.select()
			document.execCommand("copy")
			document.body.removeChild(el)
			markCopied()
		}
		if (navigator.clipboard) {
			navigator.clipboard.writeText(tempPassword).then(markCopied).catch(fallback)
		} else {
			fallback()
		}
	}

	if (withButton) {
		return (
			<Card className="h-full">
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Users</CardTitle>
						<NavigateToRoute to="/admin" />
					</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<p className="py-4 text-center text-sm text-muted">Loading…</p>
					) : (
						<ul className="divide-y divide-border">
							{users.map(user => (
								<li key={user.username} className="flex items-center justify-between py-2">
									<span className="text-sm text-primary">{user.username}</span>
									<Badge className={user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted border border-border"}>
										{user.role}
									</Badge>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="p-4">
			<Card className="bg-surface border-border">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-primary text-lg">Users</CardTitle>
					<Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setTempPassword(null); setCopied(false) } }}>
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
										<Input
											required
											value={addForm.username}
											onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))}
											className="bg-surface-raised border-border text-primary placeholder:text-muted"
											placeholder="username"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<Label className="text-primary">Role</Label>
										<Select value={addForm.role} onValueChange={v => setAddForm(f => ({ ...f, role: v }))}>
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
				</CardHeader>
				<CardContent>
					{loading ? (
						<p className="py-4 text-center text-sm text-muted">Loading…</p>
					) : (
						<ul className="divide-y divide-border">
							{users.map(user => (
								<li key={user.username} className="py-3">
									<div className="flex flex-wrap items-center gap-2">
									<div className="flex-1 min-w-0">
										<p className="text-primary font-medium truncate">{user.username}</p>
										<p className="text-xs text-muted">{user.last_login ? moment(user.last_login).fromNow() : "never logged in"}</p>
									</div>
									<Badge className={user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted border border-border"}>
										{user.role}
									</Badge>
									<div className="flex gap-2">
										<Button size="sm" variant="outline" className="border-border text-primary hover:bg-surface-raised" onClick={() => toggleSessions(user.username)}>
											{expandedSessions[user.username] ? "Hide Sessions" : "Sessions"}
										</Button>
										<Dialog open={editTarget?.username === user.username} onOpenChange={open => {
											if (open) { setEditTarget(user); setEditForm({ role: user.role, password: "" }) }
											else setEditTarget(null)
										}}>
											<DialogTrigger asChild>
												<Button size="sm" variant="outline" className="border-border text-primary hover:bg-surface-raised">Edit</Button>
											</DialogTrigger>
											<DialogContent className="bg-surface-raised border-border text-primary">
												<DialogHeader>
													<DialogTitle className="text-primary">Edit User: {user.username}</DialogTitle>
												</DialogHeader>
												<form onSubmit={updateUser} className="flex flex-col gap-4 pt-2">
													<div className="flex flex-col gap-1">
														<Label className="text-primary">Role</Label>
														<Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
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
														<Input
															type="password"
															value={editForm.password}
															onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
															className="bg-surface-raised border-border text-primary placeholder:text-muted"
															placeholder="leave blank to keep current"
														/>
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
										<Dialog open={deleteTarget?.username === user.username} onOpenChange={open => {
											if (open) setDeleteTarget(user)
											else setDeleteTarget(null)
										}}>
											<DialogTrigger asChild>
												<Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/10">Delete</Button>
											</DialogTrigger>
											<DialogContent className="bg-surface-raised border-border text-primary">
												<DialogHeader>
													<DialogTitle className="text-primary">Delete User</DialogTitle>
													<DialogDescription className="text-muted">Remove "{user.username}"? This cannot be undone.</DialogDescription>
												</DialogHeader>
												<DialogFooter>
													<DialogClose asChild>
														<Button variant="ghost" className="text-muted hover:text-primary">Cancel</Button>
													</DialogClose>
													<Button onClick={deleteUser} className="bg-danger text-danger-foreground hover:bg-danger/80">Delete</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									</div>
									</div>
									{expandedSessions[user.username] && (
										<div className="mt-2 ml-1 border-l-2 border-border pl-3">
											{!(sessions[user.username]) ? (
												<p className="text-xs text-muted py-1">Loading…</p>
											) : sessions[user.username].length === 0 ? (
												<p className="text-xs text-muted py-1">No sessions</p>
											) : (
												<ul className="flex flex-col gap-1">
													{sessions[user.username].map(sess => (
														<li key={sess.id} className={`flex items-start justify-between gap-2 py-1 ${sess.revoked ? "opacity-40" : ""}`}>
															<div className="flex flex-col min-w-0">
																<span className="text-xs text-primary">{sess.ip || "unknown IP"} · {sess.user_agent ? sess.user_agent.slice(0, 60) + (sess.user_agent.length > 60 ? "…" : "") : "unknown agent"}</span>
																<span className="text-xs text-muted">issued {moment(sess.issued_at).fromNow()} · {sess.last_seen ? `seen ${moment(sess.last_seen).fromNow()}` : "never seen"}</span>
															</div>
															{sess.revoked ? (
																<Badge className="bg-surface-raised text-muted border border-border shrink-0">revoked</Badge>
															) : (
																<Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/10 shrink-0" onClick={() => revokeSession(user.username, sess.id)}>Revoke</Button>
															)}
														</li>
													))}
												</ul>
											)}
										</div>
									)}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

export default AdminPanel
