import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary CTA - with shimmer effect on hover
        default:
          "bg-primary text-primary-foreground rounded-md hover:bg-primary/90 relative overflow-hidden group",
        destructive:
          "bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90",
        // Operation buttons - physical hover with scale and shadow
        outline:
          "border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground hover:scale-105 hover:shadow-xl active:scale-100 transition-all duration-200",
        secondary:
          "bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 hover:scale-105 hover:shadow-xl active:scale-100 transition-all duration-200",
        // Utility buttons - soft transitions
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-150",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDefault = variant === "default" || variant === undefined;

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
        {/* Shimmer overlay for primary CTA buttons */}
        {isDefault && !asChild && (
          <span
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
          </span>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };