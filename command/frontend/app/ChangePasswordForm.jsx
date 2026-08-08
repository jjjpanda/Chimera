import React, { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { validatePassword } from "../js/password.js"
import errorMessage from "../js/errors.js"

const ChangePasswordForm = ({ changePassword }) => {
	const uid = useId()
	const { t } = useTranslation()
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [status, setStatus] = useState(null)
	const [message, setMessage] = useState(null)

	const onSubmit = () => {
		if (!password || !confirm) {
			setStatus("failed")
			setMessage(t("auth.enterAndConfirmPassword"))
			return
		}
		if (password !== confirm) {
			setStatus("failed")
			setMessage(t("auth.passwordsDoNotMatch"))
			return
		}
		const invalid = validatePassword(password)
		if (invalid) {
			setStatus("failed")
			setMessage(errorMessage(invalid))
			return
		}
		changePassword({ password }, (success, errors) => {
			setStatus(success ? "done" : "failed")
			setMessage(success ? null : errorMessage(errors))
		})
	}

	const handleKeyDown = (e) => {
		if (e.key === "Enter") onSubmit()
	}

	return (
		<div className="min-h-screen bg-bg flex items-center justify-center">
			<Card className="w-80 bg-surface border-border">
				<CardHeader className="items-center gap-2 pb-2">
					<img src="/res/logo.png" alt={t("common.appName")} className="h-12 w-12 object-contain" />
					<CardTitle className="text-primary text-xl">{t("auth.changePassword")}</CardTitle>
					<p className="text-muted text-sm">{t("auth.mustSetNewPassword")}</p>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-password`} className="text-muted">{t("auth.newPassword")}</Label>
						<Input
							id={`${uid}-password`}
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder={t("auth.newPasswordPlaceholder")}
							value={password}
							onChange={e => setPassword(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
						<p className="text-muted text-xs">{errorMessage("PASSWORD_TOO_SHORT")}</p>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-confirm`} className="text-muted">{t("auth.confirmPassword")}</Label>
						<Input
							id={`${uid}-confirm`}
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							type="password"
							placeholder={t("auth.confirmPasswordPlaceholder")}
							value={confirm}
							onChange={e => setConfirm(e.target.value)}
							onKeyDown={handleKeyDown}
							autoComplete="new-password"
						/>
					</div>
					{status === "failed" && (
						<p role="alert" className="text-danger text-sm">{message || t("auth.changePasswordFailed")}</p>
					)}
					<Button
						className="bg-accent text-accent-foreground hover:opacity-90 w-full"
						onClick={onSubmit}
					>
						{t("auth.setPassword")}
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}

export default ChangePasswordForm
