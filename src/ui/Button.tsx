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
        "inline-flex h-10 items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary" && "bg-ink text-canvas hover:opacity-90",
        variant === "ghost" &&
          "border border-dashed border-hairline text-muted hover:bg-ink hover:text-canvas",
        variant === "danger" &&
          "border border-dashed border-hairline text-ink hover:bg-ink hover:text-canvas",
        className,
      )}
      {...props}
    />
  );
}
