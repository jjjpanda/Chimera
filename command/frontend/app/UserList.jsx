import React, { useState } from "react"
import moment from "moment"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import SessionList from "./SessionList.jsx"
import EditUserDialog from "./EditUserDialog.jsx"
import { request } from "../js/request.js"
import toast from "../js/toast.js"

const UserList = ({ users, fetchUsers }) => {
	const [expandedSessions, setExpandedSessions] = useState({})
	const [sessions, setSessions] = useState({})
	const [editTarget, setEditTarget] = useState(null)
	const [deleteTarget, setDeleteTarget] = useState(null)

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

	return (
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
							<Button size="sm" variant="outline" className="border-border text-primary hover:bg-surface-raised" onClick={() => setEditTarget(user)}>Edit</Button>
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
							<SessionList sessions={sessions[user.username]} username={user.username} revokeSession={revokeSession} />
						</div>
					)}
				</li>
			))}
			<EditUserDialog user={editTarget} open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)} onUpdated={fetchUsers} />
		</ul>
	)
}
export default UserList
