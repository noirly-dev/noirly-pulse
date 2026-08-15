import { cn } from "@/src/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-np-accent focus-visible:ring-offset-2 focus-visible:ring-offset-np-bg disabled:opacity-50",
        variant === "primary" && "bg-np-accent text-np-accent-fg hover:bg-[#7adefe]",
        variant === "ghost" &&
          "border border-np-border text-[#A3A3A3] hover:bg-np-surface hover:text-[#F5F5F5]",
        variant === "danger" &&
          "border border-np-warning text-np-warning hover:bg-np-warning/10",
        className,
      )}
      {...props}
    />
  );
}
