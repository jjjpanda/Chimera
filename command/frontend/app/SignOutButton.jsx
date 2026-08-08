import React, { useState } from "react"
import { LogOut } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSignOut } from "./AuthContext.jsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import toast from "../js/toast.js"
import errorMessage from "../js/errors.js"

const SignOutButton = ({ className, iconOnly }) => {
	const signOut = useSignOut()
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)

	const handleSignOut = () => {
		signOut((success, errors) => {
			if (!success) {
				setOpen(false)
				toast(errorMessage(errors) || t("auth.logOutFailed"))
			}
		})
	}

	return (
		<>
			<button onClick={() => setOpen(true)} className={className}>
				<LogOut className="size-5 shrink-0" />
				{!iconOnly && <span>{t("auth.logOut")}</span>}
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="bg-surface-raised border-border text-primary">
					<DialogHeader>
						<DialogTitle className="text-primary">{t("auth.logOut")}</DialogTitle>
						<DialogDescription className="text-muted">{t("auth.logOutConfirm")}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" className="text-muted hover:text-primary">{t("common.cancel")}</Button>
						</DialogClose>
						<Button onClick={handleSignOut} className="bg-danger text-danger-foreground hover:bg-danger/80">{t("auth.logOut")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default SignOutButton
