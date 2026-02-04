import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-blue-500/20 text-white badge-gradient-default",
        secondary:
          "border-gray-300/40 text-gray-700 dark:text-gray-200 badge-gradient-secondary",
        destructive:
          "border-red-500/20 text-white badge-gradient-destructive",
        outline:
          "border-gray-300 dark:border-gray-600 bg-transparent text-foreground",
        success:
          "border-green-500/20 text-white badge-gradient-success",
        warning:
          "border-amber-500/20 text-white badge-gradient-warning",
        info: "border-blue-500/20 text-white badge-gradient-default",
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
  ({ className, variant, style, ...props }, ref) => {
    const isOutline = variant === "outline";

    const gradientStyle: React.CSSProperties = isOutline
      ? {}
      : {
          boxShadow:
            "0 1px 2px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          fontSize: "12px",
          letterSpacing: "0.01em",
          padding: "2px 10px",
        };

    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        style={{ ...gradientStyle, ...style }}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
