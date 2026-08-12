import React, { useId, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import { validatePassword } from "../js/password.js"
import errorMessage from "../js/errors.js"

const SetupForm = ({ trySetup, tokenRequired }) => {
	const uid = useId()
	const { t } = useTranslation()
	const [status, setStatus] = useState(null)
	const [message, setMessage] = useState(null)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [token, setToken] = useState("")

	const onSubmit = (e) => {
		e.preventDefault()
		const invalid = validatePassword(password)
		if (invalid) {
			setStatus("failed")
			setMessage(errorMessage(invalid))
			return
		}
		if (password !== confirmPassword) {
			setStatus("failed")
			setMessage(t("auth.passwordsDoNotMatch"))
			return
		}
		trySetup(username, password, tokenRequired ? token : undefined, (success, errors) => {
			setStatus(success ? "done" : "failed")
			setMessage(success ? null : errorMessage(errors))
		})
	}

	if (!tokenRequired) {
		return (
			<div className="min-h-screen bg-bg flex items-center justify-center">
				<Card className="w-80 bg-surface border-border">
					<CardHeader className="items-center gap-2 pb-2">
						<img src="/res/logo.png" alt={t("common.appName")} className="h-12 w-12 object-contain" />
						<CardTitle className="text-primary text-xl">{t("common.appName")}</CardTitle>
						<p className="text-muted text-sm">{t("auth.setupUnavailable")}</p>
					</CardHeader>
					<CardContent>
						<p className="text-muted text-sm"><Trans i18nKey="auth.setupTokenHint" components={{ code: <code /> }} /></p>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-bg flex items-center justify-center">
			<Card className="w-80 bg-surface border-border">
				<CardHeader className="items-center gap-2 pb-2">
					<img src="/res/logo.png" alt={t("common.appName")} className="h-12 w-12 object-contain" />
					<CardTitle className="text-primary text-xl">{t("common.appName")}</CardTitle>
					<p className="text-muted text-sm">{t("auth.createYourAccount")}</p>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<Label htmlFor={`${uid}-username`} className="text-muted">{t("auth.username")}</Label>
							<Input
								id={`${uid}-username`}
								className="bg-surface-raised border-border text-primary placeholder:text-muted"
								placeholder={t("auth.usernamePlaceholder")}
								value={username}
								onChange={e => setUsername(e.target.value)}
								autoComplete="username"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={`${uid}-password`} className="text-muted">{t("auth.password")}</Label>
							<Input
								id={`${uid}-password`}
								className="bg-surface-raised border-border text-primary placeholder:text-muted"
								type="password"
								placeholder={t("auth.passwordPlaceholder")}
								value={password}
								onChange={e => setPassword(e.target.value)}
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
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
								autoComplete="new-password"
							/>
						</div>
						{tokenRequired && (
							<div className="flex flex-col gap-1">
								<Label htmlFor={`${uid}-token`} className="text-muted">{t("auth.setupToken")}</Label>
								<Input
									id={`${uid}-token`}
									className="bg-surface-raised border-border text-primary placeholder:text-muted"
									type="password"
									placeholder={t("auth.setupTokenPlaceholder")}
									value={token}
									onChange={e => setToken(e.target.value)}
								/>
							</div>
						)}
						{status === "failed" && (
							<p role="alert" className="text-danger text-sm">{message || t("auth.setupFailed")}</p>
						)}
						{status === "done" && (
							<p role="status" className="text-accent text-sm">{t("auth.accountCreated")}</p>
						)}
						<Button
							type="submit"
							className="bg-accent text-accent-foreground hover:opacity-90 w-full"
							disabled={status === "done"}
						>
							{t("auth.createAccount")}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}

export default SetupForm
