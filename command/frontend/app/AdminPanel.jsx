import React, { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { request } from "../js/request.js"
import toast from "../js/toast.js"

const ROLES = ["user", "admin"]

const AdminPanel = () => {
	const [users, setUsers] = useState([])
	const [loading, setLoading] = useState(false)
	const [addOpen, setAddOpen] = useState(false)
	const [addForm, setAddForm] = useState({ username: "", password: "", role: "user" })
	const [editTarget, setEditTarget] = useState(null)
	const [editForm, setEditForm] = useState({ role: "", password: "" })
	const [deleteTarget, setDeleteTarget] = useState(null)

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
				toast("User added")
				setAddForm({ username: "", password: "", role: "user" })
				setAddOpen(false)
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

	return (
		<div className="p-4">
			<Card className="bg-surface border-border">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-primary text-lg">Users</CardTitle>
					<Dialog open={addOpen} onOpenChange={setAddOpen}>
						<DialogTrigger asChild>
							<Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/80">Add User</Button>
						</DialogTrigger>
						<DialogContent className="bg-surface-raised border-border text-primary">
							<DialogHeader>
								<DialogTitle className="text-primary">Add User</DialogTitle>
								<DialogDescription className="text-muted">Create a new user account.</DialogDescription>
							</DialogHeader>
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
									<Label className="text-primary">Password</Label>
									<Input
										required
										type="password"
										value={addForm.password}
										onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
										className="bg-surface-raised border-border text-primary placeholder:text-muted"
										placeholder="password"
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
						</DialogContent>
					</Dialog>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow className="border-border hover:bg-transparent">
								<TableHead className="text-muted">Username</TableHead>
								<TableHead className="text-muted">Role</TableHead>
								<TableHead className="text-muted">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={3} className="text-center text-muted">Loading...</TableCell>
								</TableRow>
							) : users.map(user => (
								<TableRow key={user.username} className="border-border hover:bg-surface-raised">
									<TableCell className="text-primary">{user.username}</TableCell>
									<TableCell>
										<Badge className={user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted border border-border"}>
											{user.role}
										</Badge>
									</TableCell>
									<TableCell className="flex gap-2">
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
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}

export default AdminPanel
