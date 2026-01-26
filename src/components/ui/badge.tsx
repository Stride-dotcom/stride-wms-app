import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-primary/90 hover:to-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-red-400 hover:to-red-500",
        outline: "text-foreground",
        success: "border-transparent bg-gradient-to-b from-emerald-400 to-emerald-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
        warning: "border-transparent bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
        info: "border-transparent bg-gradient-to-b from-blue-400 to-blue-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
