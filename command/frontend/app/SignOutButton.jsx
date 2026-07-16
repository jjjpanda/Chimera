import React, { useState } from "react"
import { LogOut } from "lucide-react"
import { useSignOut } from "./AuthContext.jsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import toast from "../js/toast.js"

const SignOutButton = ({ className, iconOnly }) => {
	const signOut = useSignOut()
	const [open, setOpen] = useState(false)

	const handleSignOut = () => {
		signOut((success, errors) => {
			if (!success) {
				setOpen(false)
				toast(errors || "Failed to log out")
			}
		})
	}

	return (
		<>
			<button onClick={() => setOpen(true)} className={className}>
				<LogOut className="size-5 shrink-0" />
				{!iconOnly && <span>Log Out</span>}
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="bg-surface-raised border-border text-primary">
					<DialogHeader>
						<DialogTitle className="text-primary">Log Out</DialogTitle>
						<DialogDescription className="text-muted">Are you sure you want to log out?</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" className="text-muted hover:text-primary">Cancel</Button>
						</DialogClose>
						<Button onClick={handleSignOut} className="bg-danger text-danger-foreground hover:bg-danger/80">Log Out</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default SignOutButton
