import React from "react"
import moment from "moment"
import { useTranslation } from "react-i18next"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"

const SessionList = ({ sessions, username, revokeSession, retry }) => {
	const { t } = useTranslation()

	if (sessions === undefined) return <p className="text-xs text-muted py-1">{t("common.loading")}</p>
	if (sessions.error) return <p className="text-xs text-danger py-1">{t("session.loadFailed")} <button onClick={retry} className="underline hover:opacity-80">{t("common.retry")}</button></p>
	if (sessions.length === 0) return <p className="text-xs text-muted py-1">{t("session.none")}</p>

	return (
		<ul className="flex flex-col gap-1">
			{sessions.map(sess => (
				<li key={sess.id} className={`flex items-start justify-between gap-2 py-1 ${sess.revoked ? "opacity-40" : ""}`}>
					<div className="flex flex-col min-w-0">
						<span className="text-xs text-primary">{sess.ip || t("session.unknownIp")} · {sess.user_agent ? sess.user_agent.slice(0, 60) + (sess.user_agent.length > 60 ? "…" : "") : t("session.unknownAgent")}</span>
						<span className="text-xs text-muted">{t("session.issued", { ago: moment(sess.issued_at).fromNow() })} · {sess.last_seen ? t("session.seen", { ago: moment(sess.last_seen).fromNow() }) : t("session.neverSeen")}</span>
					</div>
					{sess.revoked ? (
						<Badge className="bg-surface-raised text-muted border border-border shrink-0">{t("session.revoked")}</Badge>
					) : (
						<Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/10 shrink-0" onClick={() => revokeSession(username, sess.id)}>{t("session.revoke")}</Button>
					)}
				</li>
			))}
		</ul>
	)
}
export default SessionList
