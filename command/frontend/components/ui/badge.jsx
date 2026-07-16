import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
	{
		variants: {
			variant: {
				default: "border-transparent bg-accent text-accent-foreground",
				secondary: "border-transparent bg-surface-raised text-primary",
				destructive: "border-transparent bg-danger text-danger-foreground",
				outline: "border-border text-primary"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	}
)

function Badge({ className, variant, ...props }) {
	return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
