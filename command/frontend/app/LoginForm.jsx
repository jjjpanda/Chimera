import React from "react"
import { useTranslation } from "react-i18next"
import useLoginSchema from "../hooks/useLoginSchema"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Button } from "../components/ui/button"
import errorMessage from "../js/errors.js"

const LoginForm = (props) => {
	const [loginStatus, , , inputValues, onLoginEnter, updateUsername, updatePassword, loginError] = useLoginSchema(props)
	const { t } = useTranslation()
	const uid = React.useId()

	const handleSubmit = (e) => {
		e.preventDefault()
		onLoginEnter()
	}

	return (
		<Card className="w-80 bg-surface border-border">
			<CardHeader className="items-center gap-2 pb-2">
				<img src="/res/logo.png" alt={t("common.appName")} className="h-12 w-12 object-contain" />
				<CardTitle className="text-primary text-xl">{t("common.appName")}</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<Label htmlFor={`${uid}-username`} className="text-muted">{t("auth.username")}</Label>
						<Input
							id={`${uid}-username`}
							className="bg-surface-raised border-border text-primary placeholder:text-muted"
							placeholder={t("auth.usernamePlaceholder")}
							value={inputValues.username}
							onChange={updateUsername}
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
							value={inputValues.password}
							onChange={updatePassword}
							autoComplete="current-password"
						/>
					</div>
					{loginStatus === "wrong" && (
						<p role="alert" className="text-danger text-sm">{errorMessage(loginError ?? "INVALID_CREDENTIALS")}</p>
					)}
					{loginStatus === "right" && (
						<p role="status" className="text-accent text-sm">{t("auth.signedIn")}</p>
					)}
					<Button
						type="submit"
						className="bg-accent text-accent-foreground hover:opacity-90 w-full"
					>
						{t("auth.signIn")}
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}

export default LoginForm
