import React, { useState } from "react"
import { LogOut } from "lucide-react"
import { useSignOut } from "./AuthContext.jsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../components/ui/dialog"
import { Button } from "../components/ui/button"

const SignOutButton = ({ className, iconOnly }) => {
	const signOut = useSignOut()
	const [open, setOpen] = useState(false)

	return (
		<>
			<button onClick={() => setOpen(true)} className={className}>
				<LogOut className="size-5 shrink-0" />
				{!iconOnly && <span>Sign Out</span>}
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="bg-surface-raised border-border text-primary">
					<DialogHeader>
						<DialogTitle className="text-primary">Sign Out</DialogTitle>
						<DialogDescription className="text-muted">Are you sure you want to sign out?</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="ghost" className="text-muted hover:text-primary">Cancel</Button>
						</DialogClose>
						<Button onClick={signOut} className="bg-danger text-danger-foreground hover:bg-danger/80">Sign Out</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default SignOutButton
