import { cn } from "@noirly-dev/ui";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({ className, label, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}
