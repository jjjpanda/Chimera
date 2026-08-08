import React, { useId, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"
import { request, authPromiseHandler } from "../js/request.js"
import toast from "../js/toast.js"
import { validatePassword } from "../js/password.js"
import errorMessage from "../js/errors.js"

const ROLES = ["user", "admin"]

const EditUserDialog = ({ user, open, onOpenChange, onUpdated }) => {
	const { t } = useTranslation()
	const uid = useId()
	const [form, setForm] = useState({ role: "", password: "", confirm: "" })

	useEffect(() => {
		if (user) setForm({ role: user.role, password: "", confirm: "" })
	}, [user])

	const updateUser = (e) => {
		e.preventDefault()
		if (form.password) {
			if (form.password !== form.confirm) return toast(t("auth.passwordsDoNotMatchToast"))
			const invalid = validatePassword(form.password)
			if (invalid) return toast(errorMessage(invalid))
		}
		const body = {}
		if (form.role && form.role !== user.role) body.role = form.role
		if (form.password) body.password = form.password
		if (Object.keys(body).length === 0) {
			onOpenChange(false)
			return toast(t("admin.noChanges"))
		}
		request(`/authorization/users/${encodeURIComponent(user.username)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		}, authPromiseHandler).then(res => {
			if (res.error) {
				toast(errorMessage(res.errors) || t("admin.updateUserFailed"))
			} else {
				toast(t("admin.userUpdated"))
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
					<DialogTitle className="text-primary">{t("admin.editUser", { username: user.username })}</DialogTitle>
				</DialogHeader>
				<form onSubmit={updateUser} className="flex flex-col gap-4 pt-2">
					<div className="flex flex-col gap-1">
						<Label id={`${uid}-role-label`} htmlFor={`${uid}-role`} className="text-primary">{t("admin.role.label")}</Label>
						<Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
							<SelectTrigger id={`${uid}-role`} aria-labelledby={`${uid}-role-label ${uid}-role`} className="bg-surface-raised border-border text-primary">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-surface-raised border-border text-primary">
								{ROLES.map(r => <SelectItem key={r} value={r}>{t(`admin.role.${r}`)}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-password`} className="text-primary">{t("auth.newPassword")}</Label>
						<Input id={`${uid}-password`} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-surface-raised border-border text-primary placeholder:text-muted" placeholder={t("admin.leaveBlankPlaceholder")} />
						<p className="text-muted text-xs">{errorMessage("PASSWORD_TOO_SHORT")}</p>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-confirm`} className="text-primary">{t("auth.confirmPassword")}</Label>
						<Input id={`${uid}-confirm`} type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className="bg-surface-raised border-border text-primary placeholder:text-muted" placeholder={t("auth.reenterNewPasswordPlaceholder")} />
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="ghost" className="text-muted hover:text-primary">{t("common.cancel")}</Button>
						</DialogClose>
						<Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/80">{t("common.save")}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

export default EditUserDialog
