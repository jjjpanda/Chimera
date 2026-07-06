import React, { useState, useEffect } from "react"
import moment from "moment"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { request } from "../js/request.js"
import NavigateToRoute from "./NavigateToRoute.jsx"
import UserList from "./UserList.jsx"
import AddUserDialog from "./AddUserDialog.jsx"

const AdminPanel = ({ withButton } = {}) => {
	const [users, setUsers] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)

	const fetchUsers = () => {
		setLoading(true)
		setError(false)
		request("/authorization/users", { method: "GET" }, p => p.then(r => r.json()).catch(() => ({ error: true })))
			.then(data => {
				if (!data.error) setUsers(data)
				else setError(true)
				setLoading(false)
			})
	}

	useEffect(() => { fetchUsers() }, [])

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
					) : error ? (
						<p className="py-4 text-center text-sm text-danger">Failed to load users. <button onClick={fetchUsers} className="underline hover:opacity-80">Retry</button></p>
					) : (
						<ul className="divide-y divide-border overflow-y-auto max-h-44">
							{users.map(user => (
								<li key={user.username} className="flex items-center justify-between gap-2 py-2 min-w-0">
									<div className="flex flex-col min-w-0">
										<span className="text-sm text-primary truncate">{user.username}</span>
										<span className="text-[11px] text-muted">{user.last_login ? moment(user.last_login).fromNow() : "never"}</span>
									</div>
									<Badge className={`shrink-0 ${user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-surface-raised text-muted border border-border"}`}>
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
					<AddUserDialog onAdded={fetchUsers} />
				</CardHeader>
				<CardContent>
					{loading ? (
						<p className="py-4 text-center text-sm text-muted">Loading…</p>
					) : error ? (
						<p className="py-4 text-center text-sm text-danger">Failed to load users. <button onClick={fetchUsers} className="underline hover:opacity-80">Retry</button></p>
					) : (
						<UserList users={users} fetchUsers={fetchUsers} />
					)}
				</CardContent>
			</Card>
		</div>
	)
}

export default AdminPanel
