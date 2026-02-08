import React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary/15 text-primary border border-primary/25",
  secondary: "bg-secondary text-secondary-foreground border border-secondary",
  destructive: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25",
  outline: "border border-border text-foreground bg-transparent",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
