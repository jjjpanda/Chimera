import React, { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { useChangePassword } from "./AuthContext.jsx"
import LanguagePicker from "./LanguagePicker.jsx"
import { validatePassword } from "../js/password.js"
import toast from "../js/toast.js"
import errorMessage from "../js/errors.js"

const emptyForm = { currentPassword: "", password: "", confirm: "" }

const AccountSettings = () => {
	const changePassword = useChangePassword()
	const { t } = useTranslation()
	const uid = useId()
	const [form, setForm] = useState(emptyForm)
	const [pending, setPending] = useState(false)

	const submit = (e) => {
		e.preventDefault()
		if (pending) return
		if (!form.currentPassword) return toast(t("auth.enterCurrentPassword"))
		if (form.password !== form.confirm) return toast(t("auth.passwordsDoNotMatchToast"))
		const invalid = validatePassword(form.password)
		if (invalid) return toast(errorMessage(invalid))
		setPending(true)
		changePassword({ password: form.password, currentPassword: form.currentPassword }, (success, errors) => {
			setPending(false)
			if (!success) return toast(errorMessage(errors) || t("auth.changePasswordFailedToast"))
			setForm(emptyForm)
			toast(t("auth.passwordChanged"))
		})
	}

	const field = (key, label, placeholder, autoComplete) => (
		<div className="flex flex-col gap-1">
			<Label htmlFor={`${uid}-${key}`} className="text-primary">{label}</Label>
			<Input
				id={`${uid}-${key}`}
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
		<div className="flex flex-col gap-4">
			<Card className="max-w-md">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">{t("language.preferences")}</CardTitle>
				</CardHeader>
				<CardContent>
					<LanguagePicker />
				</CardContent>
			</Card>
			<Card className="max-w-md">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm">{t("auth.changePassword")}</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={submit} className="flex flex-col gap-4 pt-2">
						{field("currentPassword", t("auth.currentPassword"), t("auth.currentPasswordPlaceholder"), "current-password")}
						{field("password", t("auth.newPassword"), t("auth.newPasswordPlaceholder"), "new-password")}
						<p className="text-xs text-muted -mt-3">{errorMessage("PASSWORD_TOO_SHORT")}</p>
						{field("confirm", t("auth.confirmPassword"), t("auth.reenterNewPasswordPlaceholder"), "new-password")}
						<p className="text-xs text-muted">{t("auth.signsYouOut")}</p>
						<Button type="submit" disabled={pending} className="self-start bg-accent text-accent-foreground hover:bg-accent/80">{t("auth.changePassword")}</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}

export default AccountSettings
