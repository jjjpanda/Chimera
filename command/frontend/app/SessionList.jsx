import React from "react"
import moment from "moment"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"

const SessionList = ({ sessions, username, revokeSession }) => {
	if (!sessions) return <p className="text-xs text-muted py-1">Loading…</p>
	if (sessions.length === 0) return <p className="text-xs text-muted py-1">No sessions</p>

	return (
		<ul className="flex flex-col gap-1">
			{sessions.map(sess => (
				<li key={sess.id} className={`flex items-start justify-between gap-2 py-1 ${sess.revoked ? "opacity-40" : ""}`}>
					<div className="flex flex-col min-w-0">
						<span className="text-xs text-primary">{sess.ip || "unknown IP"} · {sess.user_agent ? sess.user_agent.slice(0, 60) + (sess.user_agent.length > 60 ? "…" : "") : "unknown agent"}</span>
						<span className="text-xs text-muted">issued {moment(sess.issued_at).fromNow()} · {sess.last_seen ? `seen ${moment(sess.last_seen).fromNow()}` : "never seen"}</span>
					</div>
					{sess.revoked ? (
						<Badge className="bg-surface-raised text-muted border border-border shrink-0">revoked</Badge>
					) : (
						<Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/10 shrink-0" onClick={() => revokeSession(username, sess.id)}>Revoke</Button>
					)}
				</li>
			))}
		</ul>
	)
}
export default SessionList
